import { describe, expect, it } from "vitest";
import {
  averageByCategory,
  categoryWeek,
  spendByCategory,
  monthlyToWeekly,
  weekElapsed,
  weekShares,
  weekSummary,
  weeklyHistory,
  weeklyToMonthly,
  type BudgetTx,
} from "@/lib/budget";
import { addDays, daysBetween, sameDayNextMonth, weekStart } from "@/lib/dates";
import { goalProgress } from "@/lib/goals";

const tx = (id: string, fecha: string, monto: number, category_id: string | null, rec = false): BudgetTx => ({
  id, fecha, monto, category_id, es_recurrente: rec, comercio: id, descripcion_original: id,
});
const cat = (id: string, mensual: number) => ({ id, nombre: id, presupuesto_mensual: mensual, color_neutro: "#000" });

describe("fechas", () => {
  it("la semana empieza en lunes", () => {
    expect(weekStart("2026-11-12")).toBe("2026-11-09"); // jueves
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // lunes
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // domingo, cruza de mes
  });
  it("suma días y mide diferencias", () => {
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(daysBetween("2026-11-09", "2026-11-16")).toBe(7);
  });
  it("mismo día del mes siguiente, ajustando meses cortos", () => {
    expect(sameDayNextMonth("2026-11-05")).toBe("2026-12-05");
    expect(sameDayNextMonth("2026-01-31")).toBe("2026-02-28");
    expect(sameDayNextMonth("2026-12-15")).toBe("2027-01-15");
  });
});

describe("presupuesto semanal", () => {
  it("convierte mensual a semanal y de vuelta sin perder centavos", () => {
    expect(monthlyToWeekly(2200)).toBe(507.69);
    for (const weekly of [200, 184.62, 57.5, 33.33, 0]) {
      expect(monthlyToWeekly(weeklyToMonthly(weekly))).toBe(weekly);
    }
  });

  it("avance de la semana: lunes 1/7, domingo completo", () => {
    expect(weekElapsed("2026-11-09", "2026-11-09")).toBeCloseTo(1 / 7);
    expect(weekElapsed("2026-11-09", "2026-11-12")).toBeCloseTo(4 / 7);
    expect(weekElapsed("2026-11-09", "2026-11-15")).toBe(1);
    expect(weekElapsed("2026-11-09", "2026-12-01")).toBe(1); // semana pasada
    expect(weekElapsed("2026-11-09", "2026-11-01")).toBe(0); // semana futura
  });

  it("un gasto normal cuenta completo solo en su semana", () => {
    const txs = [tx("a", "2026-11-09", 50, "c"), tx("b", "2026-11-15", 20, "c"), tx("c", "2026-11-16", 99, "c")];
    expect(weekShares(txs, "2026-11-09", true).map((s) => s.amount)).toEqual([50, 20]);
  });

  it("un cargo fijo mensual se reparte por semana con la misma conversión que el presupuesto", () => {
    const renta = [tx("renta", "2026-11-01", 2200, "viv", true)];
    // Una semana completa dentro del periodo se lleva monto × 12 ÷ 52.
    expect(weekShares(renta, "2026-11-09", true)[0].amount).toBeCloseTo((2200 * 12) / 52);
    // La semana en que empieza solo cuenta sus días: el 1 de nov es domingo → 1 día.
    expect(weekShares(renta, "2026-10-26", true)[0].amount).toBeCloseTo((2200 * 12) / 364);
    // El periodo termina el 1 de dic (martes): esa semana solo cuenta el lunes.
    expect(weekShares(renta, "2026-11-30", true)[0].amount).toBeCloseTo((2200 * 12) / 364);
    expect(weekShares(renta, "2026-12-07", true)).toEqual([]);
    // Sin reparto, la semana del 9 no ve la renta y la del 26 oct (que incluye el día 1) la ve entera.
    expect(weekShares(renta, "2026-11-09", false)).toEqual([]);
    expect(weekShares(renta, "2026-10-26", false)[0].amount).toBe(2200);
  });

  it("estados: ok, en riesgo y excedido", () => {
    const c = cat("rest", weeklyToMonthly(70)); // $70 por semana
    const elapsed = 2 / 7; // martes ≈ 28.6 %
    // 20 de 70 = 28.6 % gastado, igual al avance → ok
    expect(categoryWeek(c, weekShares([tx("a", "2026-11-09", 20, "rest")], "2026-11-09", true), elapsed).estado).toBe("ok");
    // 40 de 70 = 57 %, 28.5 puntos por encima → en riesgo
    const riesgo = categoryWeek(c, weekShares([tx("a", "2026-11-09", 40, "rest")], "2026-11-09", true), elapsed);
    expect(riesgo.estado).toBe("en_riesgo");
    expect(riesgo.ritmo).toBeCloseTo(57.14 - 28.57, 1);
    expect(riesgo.proyeccion).toBe(140); // 40 en 2 días → 140 en 7
    // 80 de 70 → excedido, aunque sea lunes
    const excedido = categoryWeek(c, weekShares([tx("a", "2026-11-09", 80, "rest")], "2026-11-09", true), 1 / 7);
    expect(excedido).toMatchObject({ estado: "excedido", diferencia: 10 });
    expect(excedido.porcentaje).toBeCloseTo(114.29, 1);
  });

  it("un cargo fijo igual a su presupuesto queda al 100 % y en orden, incluso el lunes", () => {
    const c = cat("viv", 2200);
    const shares = weekShares([tx("renta", "2026-11-01", 2200, "viv", true)], "2026-11-09", true);
    const result = categoryWeek(c, shares, 1 / 7);
    expect(result).toMatchObject({ gastado: 507.69, presupuesto: 507.69, diferencia: 0, estado: "ok" });
    expect(result.proyeccion).toBe(507.69); // lo fijo no se proyecta
    expect(result.ritmo).toBeCloseTo(0);
  });

  it("una categoría sin presupuesto no se marca como excedida", () => {
    const shares = weekShares([tx("a", "2026-11-09", 80, "x")], "2026-11-09", true);
    expect(categoryWeek(cat("x", 0), shares, 1 / 7)).toMatchObject({
      estado: "sin_presupuesto", gastado: 80, porcentaje: null, ritmo: null,
    });
  });

  it("ordena de mayor a menor exceso y muestra los 3 movimientos más grandes", () => {
    const cats = [cat("a", weeklyToMonthly(100)), cat("b", weeklyToMonthly(100)), cat("c", 0)];
    const txs = [
      tx("a1", "2026-11-09", 30, "a"),
      tx("b1", "2026-11-09", 60, "b"), tx("b2", "2026-11-10", 90, "b"), tx("b3", "2026-11-10", 5, "b"), tx("b4", "2026-11-11", 10, "b"),
      tx("x", "2026-11-10", 12, null),
    ];
    const s = weekSummary(cats, txs, { start: "2026-11-09", today: "2026-11-12", prorate: true });
    expect(s.categorias.map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(s.categorias[0].top.map((t) => t.id)).toEqual(["b2", "b1", "b4"]);
    // El gasto sin categoría (p. ej. un depósito) no cuenta contra el presupuesto.
    expect(s).toMatchObject({ gastado: 195, presupuesto: 200, sinCategoria: 12 });
  });

  it("historial y promedio por categoría", () => {
    const txs = [
      tx("a", "2026-11-02", 70, "c"), tx("b", "2026-10-27", 30, "c"), tx("c", "2026-11-10", 10, "c"),
      tx("bond", "2026-11-03", 1050, null),
    ];
    expect(weeklyHistory(txs, "2026-11-09", 3, true)).toEqual([
      { start: "2026-10-26", gastado: 30 },
      { start: "2026-11-02", gastado: 70 },
      { start: "2026-11-09", gastado: 10 },
    ]);
    // Promedio de las 2 semanas completas anteriores: (70 + 30) / 2
    const avg = averageByCategory([cat("c", weeklyToMonthly(40))], txs, "2026-11-09", 2, true);
    expect(avg[0]).toMatchObject({ promedio: 50, presupuesto: 40, exceso: 10 });
  });
});

describe("gasto por categoría (gráfico de sectores)", () => {
  it("suma una o varias semanas y deja fuera lo que no tiene categoría", () => {
    const cats = [cat("a", 0), cat("b", 0), cat("c", 0)];
    const txs = [
      tx("a1", "2026-11-10", 30, "a"), tx("a2", "2026-11-03", 20, "a"),
      tx("b1", "2026-10-20", 50, "b"), tx("viejo", "2026-10-01", 999, "b"),
      tx("bond", "2026-11-10", 1050, null),
    ];
    expect(spendByCategory(cats, txs, "2026-11-09", 1, true).map((c) => c.total)).toEqual([30, 0, 0]);
    expect(spendByCategory(cats, txs, "2026-11-09", 4, true).map((c) => c.total)).toEqual([50, 50, 0]);
  });
});

describe("metas de ahorro", () => {
  const goal = { id: "g", nombre: "Viaje", monto_objetivo: 6000, monto_actual: 1500, fecha_objetivo: "2027-06-10" };
  const today = "2026-11-12";

  it("calcula lo que falta y cuánto apartar por semana y por quincena", () => {
    const p = goalProgress(goal, [], today);
    expect(p.falta).toBe(4500);
    expect(p.porcentaje).toBe(25);
    expect(p.semanasRestantes).toBe(30); // 210 días
    expect(p.porSemana).toBe(150);
    expect(p.porQuincena).toBe(300);
    expect(p.estado).toBe("sin_ritmo");
  });

  it("al ritmo de las últimas 13 semanas: a tiempo o con retraso", () => {
    const c = (fecha: string, monto: number) => ({ goal_id: "g", fecha, monto });
    // 1950 en 13 semanas = 150 por semana → justo a tiempo
    const onTime = goalProgress(goal, [c("2026-09-01", 950), c("2026-11-01", 1000)], today);
    expect(onTime).toMatchObject({ ritmoSemanal: 150, estado: "a_tiempo", semanasRetraso: 0, diferenciaSemanal: 0 });
    // 975 en 13 semanas = 75 por semana → necesita 60 semanas, 30 de retraso
    const late = goalProgress(goal, [c("2026-10-01", 975), c("2026-01-01", 5000)], today);
    expect(late).toMatchObject({ ritmoSemanal: 75, estado: "retraso", semanasRetraso: 30, diferenciaSemanal: 75 });
    expect(late.fechaEstimada).toBe(addDays(today, 420));
  });

  it("meta cumplida o vencida", () => {
    expect(goalProgress({ ...goal, monto_actual: 6000 }, [], today).estado).toBe("cumplida");
    expect(goalProgress({ ...goal, fecha_objetivo: "2026-10-01" }, [], today).estado).toBe("vencida");
    // con menos de una semana por delante, lo que falta se necesita completo
    expect(goalProgress({ ...goal, fecha_objetivo: "2026-11-14" }, [], today).porSemana).toBe(4500);
  });
});
