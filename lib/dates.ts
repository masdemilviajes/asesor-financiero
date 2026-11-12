// Fechas como texto YYYY-MM-DD, calculadas en UTC para que no dependan de
// la zona horaria del servidor. La semana va de lunes a domingo.

function toDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

function toText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(fecha: string, days: number): string {
  const d = toDate(fecha);
  d.setUTCDate(d.getUTCDate() + days);
  return toText(d);
}

/** Días de a hasta b (positivo si b es posterior). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function weekStart(fecha: string): string {
  const day = toDate(fecha).getUTCDay(); // 0 = domingo
  return addDays(fecha, -((day + 6) % 7));
}

/** El mismo día del mes siguiente (31 ene → 28 feb). */
export function sameDayNextMonth(fecha: string): string {
  const d = toDate(fecha);
  const day = d.getUTCDate();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return toText(next);
}

export function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(toDate(value).getTime())
  );
}

const shortDay = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });

/** "9 nov – 15 nov" para la semana que empieza en `start`. */
export function formatWeek(start: string): string {
  return `${shortDay.format(toDate(start))} – ${shortDay.format(toDate(addDays(start, 6)))}`;
}

/** "9 nov" */
export function formatShortDay(fecha: string): string {
  return shortDay.format(toDate(fecha));
}
