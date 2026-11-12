// Detección de cargos recurrentes: el mismo comercio, con monto similar,
// aproximadamente una vez al mes durante al menos 3 meses.

export type RecurringCandidate = {
  id: string;
  fecha: string; // YYYY-MM-DD
  monto: number;
  comercio: string | null;
  descripcion_original: string;
};

/** Clave para agrupar movimientos del mismo comercio ("NETFLIX.COM 8842" → "netflix com"). */
export function merchantKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !/\d/.test(token))
    .slice(0, 3)
    .join(" ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const MIN_MONTHS = 3;
const TOLERANCE = 0.1; // ±10 % del monto típico

/** Devuelve los ids de los gastos que parecen cargos recurrentes mensuales. */
export function findRecurringIds(transactions: RecurringCandidate[]): string[] {
  const groups = new Map<string, RecurringCandidate[]>();
  for (const t of transactions) {
    const key = merchantKey(t.comercio || t.descripcion_original);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const ids: string[] = [];
  for (const list of groups.values()) {
    const allMonths = new Set(list.map((t) => t.fecha.slice(0, 7)));
    // Un comercio al que se va varias veces al mes (súper, café) no es un cargo recurrente.
    if (list.length > allMonths.size + 1) continue;

    const typical = median(list.map((t) => Number(t.monto)));
    const similar = list.filter(
      (t) => Math.abs(Number(t.monto) - typical) <= Math.max(typical * TOLERANCE, 1),
    );
    const months = new Set(similar.map((t) => t.fecha.slice(0, 7)));
    if (months.size >= MIN_MONTHS) ids.push(...similar.map((t) => t.id));
  }
  return ids;
}
