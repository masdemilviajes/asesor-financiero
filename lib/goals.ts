// Metas de ahorro, calculadas por semana. Funciones puras.

import { addDays, daysBetween } from "@/lib/dates";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Goal = {
  id: string;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_objetivo: string;
};

export type Contribution = { goal_id: string; fecha: string; monto: number };

/** Semanas que se miran para medir el ritmo real de ahorro (≈ 3 meses). */
export const PACE_WEEKS = 13;

export type GoalStatus = "cumplida" | "a_tiempo" | "retraso" | "sin_ritmo" | "vencida";

export type GoalProgress = {
  falta: number;
  porcentaje: number;
  /** Semanas que quedan hasta la fecha objetivo (mínimo 0). */
  semanasRestantes: number;
  /** Lo que habría que apartar para llegar a la fecha. */
  porSemana: number;
  porQuincena: number;
  /** Promedio semanal aportado en las últimas 13 semanas. */
  ritmoSemanal: number;
  /** Cuánto falta por semana respecto al ritmo actual (0 si ya alcanza). */
  diferenciaSemanal: number;
  estado: GoalStatus;
  /** Semanas de retraso respecto a la fecha objetivo, al ritmo actual. */
  semanasRetraso: number;
  /** Fecha estimada de llegada al ritmo actual (null si no hay ritmo). */
  fechaEstimada: string | null;
};

export function goalProgress(goal: Goal, contributions: Contribution[], today: string): GoalProgress {
  const objetivo = Number(goal.monto_objetivo);
  const actual = Number(goal.monto_actual);
  const falta = round2(Math.max(objetivo - actual, 0));
  const porcentaje = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;

  const diasRestantes = daysBetween(today, goal.fecha_objetivo);
  const semanasRestantes = Math.max(diasRestantes / 7, 0);

  const since = addDays(today, -7 * PACE_WEEKS);
  const aportado = contributions
    .filter((c) => c.goal_id === goal.id && c.fecha > since && c.fecha <= today)
    .reduce((sum, c) => sum + Number(c.monto), 0);
  const ritmoSemanal = round2(aportado / PACE_WEEKS);

  // Si quedan menos de una semana, lo que falta se necesita ya.
  const porSemana = falta === 0 ? 0 : round2(falta / Math.max(semanasRestantes, 1));
  const base = {
    falta,
    porcentaje,
    semanasRestantes,
    porSemana,
    porQuincena: round2(porSemana * 2),
    ritmoSemanal,
    diferenciaSemanal: round2(Math.max(porSemana - ritmoSemanal, 0)),
  };

  if (falta === 0) {
    return { ...base, estado: "cumplida", semanasRetraso: 0, fechaEstimada: null };
  }
  if (ritmoSemanal <= 0) {
    return {
      ...base,
      estado: diasRestantes < 0 ? "vencida" : "sin_ritmo",
      semanasRetraso: 0,
      fechaEstimada: null,
    };
  }

  const semanasNecesarias = falta / ritmoSemanal;
  const fechaEstimada = addDays(today, Math.ceil(semanasNecesarias * 7));
  const semanasRetraso = Math.max(Math.ceil(semanasNecesarias - semanasRestantes), 0);
  const estado: GoalStatus =
    diasRestantes < 0 ? "vencida" : semanasRetraso === 0 ? "a_tiempo" : "retraso";

  return { ...base, estado, semanasRetraso, fechaEstimada };
}
