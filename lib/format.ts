// Utilidades de fechas y números que sirven tanto en servidor como en navegador.

/** Convierte "1,234.50", "$350" o "350" en número. Devuelve NaN si no es válido. */
export function parseAmount(input: unknown): number {
  if (typeof input === "number") return input;
  const cleaned = String(input ?? "")
    .replace(/[^0-9.,-]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "") // comas de miles
    .replace(",", "."); // coma decimal
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  return Number(cleaned);
}

const dayFormatter = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-05" → "jue, 5 nov" */
export function formatDay(fecha: string): string {
  return dayFormatter.format(new Date(`${fecha}T00:00:00Z`));
}

/** "2026-11" → "noviembre de 2026" */
export function formatMonth(mes: string): string {
  return monthFormatter.format(new Date(`${mes}-01T00:00:00Z`));
}

/** Suma (o resta) meses a un "YYYY-MM". */
export function addMonths(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primer día del mes y primer día del mes siguiente, para filtrar por fecha. */
export function monthRange(mes: string): { start: string; end: string } {
  return { start: `${mes}-01`, end: `${addMonths(mes, 1)}-01` };
}

export function isValidMonth(mes: unknown): mes is string {
  return typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** Elige singular o plural: plural(1, "fila", "filas") → "1 fila". */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
