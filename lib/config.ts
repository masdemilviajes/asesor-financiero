// Configuración general de la app. Los valores por defecto son los del dueño
// de la app; se pueden cambiar con variables de entorno sin tocar el código.

export const CURRENCY = process.env.NEXT_PUBLIC_APP_CURRENCY ?? "AUD";
export const TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Australia/Sydney";
export const NUMBER_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE ?? "en-AU";

const moneyFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un monto con separador de miles y moneda, p. ej. $1,234.50 */
export function formatMoney(amount: number | string | null | undefined): string {
  const value = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria configurada. */
export function todayInTimezone(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
