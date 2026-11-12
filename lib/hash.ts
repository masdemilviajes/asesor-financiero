import { createHash } from "node:crypto";

/** Normaliza la descripción para comparar: minúsculas y espacios simples. */
export function normalizeDescription(descripcion: string): string {
  return descripcion.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Huella única de un movimiento: fecha + monto + descripción.
 * Dos movimientos con la misma huella se consideran duplicados.
 * (La misma fórmula se usa en supabase/seed.sql.)
 */
export function transactionHash(fecha: string, monto: number, descripcion: string): string {
  const base = `${fecha}|${monto.toFixed(2)}|${normalizeDescription(descripcion)}`;
  return createHash("sha256").update(base, "utf8").digest("hex");
}

/** Huella para un movimiento que el usuario decidió guardar aunque se repita. */
export function forcedDuplicateHash(fecha: string, monto: number, descripcion: string): string {
  const base = `${fecha}|${monto.toFixed(2)}|${normalizeDescription(descripcion)}|${crypto.randomUUID()}`;
  return createHash("sha256").update(base, "utf8").digest("hex");
}

/**
 * Huella para la n-ésima aparición de un movimiento idéntico dentro del mismo
 * archivo (dos cafés iguales el mismo día). La primera usa la huella normal;
 * así, si se importa dos veces el mismo archivo, todo se detecta como duplicado.
 */
export function occurrenceHash(
  fecha: string,
  monto: number,
  descripcion: string,
  occurrence: number,
): string {
  if (occurrence <= 1) return transactionHash(fecha, monto, descripcion);
  const base = `${fecha}|${monto.toFixed(2)}|${normalizeDescription(descripcion)}|#${occurrence}`;
  return createHash("sha256").update(base, "utf8").digest("hex");
}
