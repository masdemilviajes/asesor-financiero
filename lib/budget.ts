// Presupuesto semanal: gasto por categoría, ritmo, estado y proyección.
// Funciones puras (sin red ni base de datos) para poder probarlas.

import { addDays, daysBetween, sameDayNextMonth } from "@/lib/dates";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 52 semanas exactas: la base común para pasar de mes a semana. */
const DAYS_PER_YEAR = 52 * 7;

/** El presupuesto se guarda por mes (presupuesto_mensual) y se muestra por semana. */
export function monthlyToWeekly(monthly: number): number {
  return round2((Number(monthly) * 12) / 52);
}

export function weeklyToMonthly(weekly: number): number {
  return round2((Number(weekly) * 52) / 12);
}

export type BudgetTx = {
  id: string;
  fecha: string;
  monto: number;
  category_id: string | null;
  es_recurrente: boolean;
  comercio: string | null;
  descripcion_original: string;
};

export type BudgetCategory = {
  id: string;
  nombre: string;
  presupuesto_mensual: number;
  color_neutro: string;
};

export type WeekOptions = {
  /** Lunes de la semana a calcular. */
  start: string;
  /** Fecha de hoy; define cuánto de la semana ha transcurrido. */
  today: string;
  /** Repartir los cargos fijos mensuales entre las semanas que cubren. */
  prorate: boolean;
};

/** Parte de un movimiento que cuenta para una semana. */
export type WeekShare = { tx: BudgetTx; amount: number; fixed: boolean };

/**
 * Cuánto de cada gasto corresponde a la semana [start, start + 7).
 * - Gasto normal: cuenta completo si su fecha cae en la semana.
 * - Cargo fijo mensual (con reparto): cubre desde su fecha hasta el mismo día
 *   del mes siguiente, y cada semana completa se lleva monto × 12 ÷ 52. Es la
 *   misma conversión que usa el presupuesto, así que un cargo fijo igual a su
 *   presupuesto mensual queda exactamente al 100 %.
 */
export function weekShares(txs: BudgetTx[], start: string, prorate: boolean): WeekShare[] {
  const end = addDays(start, 7);
  const shares: WeekShare[] = [];
  for (const tx of txs) {
    const monto = Number(tx.monto);
    if (prorate && tx.es_recurrente) {
      const periodEnd = sameDayNextMonth(tx.fecha);
      const from = tx.fecha > start ? tx.fecha : start;
      const to = periodEnd < end ? periodEnd : end;
      const overlap = daysBetween(from, to);
      if (overlap > 0) {
        shares.push({ tx, amount: (monto * 12 * overlap) / DAYS_PER_YEAR, fixed: true });
      }
    } else if (tx.fecha >= start && tx.fecha < end) {
      shares.push({ tx, amount: monto, fixed: false });
    }
  }
  return shares;
}

/** Fracción de la semana transcurrida (1/7 el lunes … 1 el domingo o después). */
export function weekElapsed(start: string, today: string): number {
  const days = daysBetween(start, today) + 1;
  return Math.min(Math.max(days, 0), 7) / 7;
}

export type CategoryStatus = "ok" | "en_riesgo" | "excedido" | "sin_presupuesto";

export type TopItem = { id: string; label: string; amount: number; fixed: boolean };

export type CategoryWeek = {
  id: string;
  nombre: string;
  color: string;
  presupuesto: number;
  gastado: number;
  /** gastado − presupuesto: positivo si se pasó. */
  diferencia: number;
  /** gastado como porcentaje del presupuesto (null si no hay presupuesto). */
  porcentaje: number | null;
  /** Puntos porcentuales por encima (+) o por debajo (−) del avance de la semana. */
  ritmo: number | null;
  proyeccion: number;
  estado: CategoryStatus;
  top: TopItem[];
};

/** Más de 20 puntos por encima del avance de la semana = "en riesgo". */
export const RISK_POINTS = 20;

export function categoryWeek(
  category: BudgetCategory,
  shares: WeekShare[],
  elapsed: number,
): CategoryWeek {
  const own = shares.filter((s) => s.tx.category_id === category.id);
  const fixed = own.filter((s) => s.fixed).reduce((sum, s) => sum + s.amount, 0);
  const variable = own.filter((s) => !s.fixed).reduce((sum, s) => sum + s.amount, 0);

  const presupuesto = monthlyToWeekly(category.presupuesto_mensual);
  const gastado = round2(fixed + variable);
  const diferencia = round2(gastado - presupuesto);

  // Lo variable se proyecta al ritmo actual; lo fijo ya se conoce para toda la semana.
  const proyeccion = round2(fixed + (elapsed > 0 ? variable / elapsed : variable));

  let porcentaje: number | null = null;
  let ritmo: number | null = null;
  let estado: CategoryStatus = "sin_presupuesto";

  if (presupuesto > 0) {
    porcentaje = (gastado / presupuesto) * 100;
    // Para el ritmo, lo fijo se va "consumiendo" día a día igual que la semana.
    const pace = ((variable + fixed * elapsed) / presupuesto) * 100;
    ritmo = pace - elapsed * 100;
    estado = gastado > presupuesto + 0.005 ? "excedido" : ritmo > RISK_POINTS ? "en_riesgo" : "ok";
  }
  // Sin presupuesto definido no hay contra qué comparar: no es "excedido".

  const top = [...own]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((s) => ({
      id: s.tx.id,
      label: s.tx.comercio || s.tx.descripcion_original,
      amount: round2(s.amount),
      fixed: s.fixed,
    }));

  return {
    id: category.id,
    nombre: category.nombre,
    color: category.color_neutro,
    presupuesto,
    gastado,
    diferencia,
    porcentaje,
    ritmo,
    proyeccion,
    estado,
    top,
  };
}

export type WeekSummary = {
  categorias: CategoryWeek[];
  /** Gasto en categorías: es lo que se compara contra el presupuesto. */
  gastado: number;
  presupuesto: number;
  /**
   * Gastos sin categoría (un depósito, una transferencia…): no cuentan para
   * el presupuesto y se muestran aparte.
   */
  sinCategoria: number;
  elapsed: number;
};

/** Resumen de una semana, con las categorías ordenadas de mayor a menor exceso. */
export function weekSummary(
  categories: BudgetCategory[],
  txs: BudgetTx[],
  options: WeekOptions,
): WeekSummary {
  const shares = weekShares(txs, options.start, options.prorate);
  const elapsed = weekElapsed(options.start, options.today);
  const categorias = categories
    .map((c) => categoryWeek(c, shares, elapsed))
    // A igual exceso, primero donde más se ha gastado.
    .sort((a, b) => b.diferencia - a.diferencia || b.gastado - a.gastado);

  const known = new Set(categories.map((c) => c.id));
  const sinCategoria = shares
    .filter((s) => !s.tx.category_id || !known.has(s.tx.category_id))
    .reduce((sum, s) => sum + s.amount, 0);

  return {
    categorias,
    gastado: round2(categorias.reduce((sum, c) => sum + c.gastado, 0)),
    presupuesto: round2(categorias.reduce((sum, c) => sum + c.presupuesto, 0)),
    sinCategoria: round2(sinCategoria),
    elapsed,
  };
}

export type WeekPoint = { start: string; gastado: number };

/** Gasto total de las últimas `weeks` semanas, terminando en la de `start`. */
export function weeklyHistory(
  txs: BudgetTx[],
  start: string,
  weeks: number,
  prorate: boolean,
): WeekPoint[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStartDate = addDays(start, -7 * (weeks - 1 - i));
    // Igual que en el resumen: lo que no tiene categoría queda fuera del presupuesto.
    const total = weekShares(txs, weekStartDate, prorate)
      .filter((s) => s.tx.category_id)
      .reduce((sum, s) => sum + s.amount, 0);
    return { start: weekStartDate, gastado: round2(total) };
  });
}

/** Promedio semanal por categoría en las `weeks` semanas completas anteriores a `start`. */
export function averageByCategory(
  categories: BudgetCategory[],
  txs: BudgetTx[],
  start: string,
  weeks: number,
  prorate: boolean,
): { id: string; nombre: string; presupuesto: number; promedio: number; exceso: number }[] {
  const totals = new Map<string, number>();
  for (let i = 1; i <= weeks; i++) {
    for (const share of weekShares(txs, addDays(start, -7 * i), prorate)) {
      const id = share.tx.category_id;
      if (id) totals.set(id, (totals.get(id) ?? 0) + share.amount);
    }
  }
  return categories
    .map((c) => {
      const presupuesto = monthlyToWeekly(c.presupuesto_mensual);
      const promedio = round2((totals.get(c.id) ?? 0) / weeks);
      return { id: c.id, nombre: c.nombre, presupuesto, promedio, exceso: round2(promedio - presupuesto) };
    })
    .sort((a, b) => b.exceso - a.exceso);
}
