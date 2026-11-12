import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { occurrenceHash } from "@/lib/hash";
import { findRecurringIds, type RecurringCandidate } from "@/lib/recurring";
import { maskSensitive, type ImportRow } from "./parse";

export const STATEMENTS_BUCKET = "estados-de-cuenta";
const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por consulta.

export type HashedRow = ImportRow & { hash_unico: string };

/** Oculta números sensibles y calcula la huella de cada movimiento del lote. */
export function withHashes(rows: ImportRow[]): HashedRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const descripcion = maskSensitive(row.descripcion).slice(0, 300);
    const base = occurrenceHash(row.fecha, row.monto, descripcion, 1);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return {
      ...row,
      descripcion,
      hash_unico: occurrenceHash(row.fecha, row.monto, descripcion, occurrence),
    };
  });
}

/** Huellas que ya existen en la base de datos dentro de un rango de fechas. */
export async function existingHashes(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<Set<string>> {
  const hashes = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("hash_unico")
      .gte("fecha", from)
      .lte("fecha", to)
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    data.forEach((row) => hashes.add(row.hash_unico));
    if (data.length < PAGE) break;
  }
  return hashes;
}

/**
 * Marca como recurrentes los cargos que se repiten con monto similar cada mes.
 * Revisa los gastos de los últimos 6 meses.
 */
export async function markRecurring(supabase: SupabaseClient): Promise<number> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 6);
  const from = since.toISOString().slice(0, 10);

  const candidates: (RecurringCandidate & { es_recurrente: boolean })[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, fecha, monto, comercio, descripcion_original, es_recurrente")
      .eq("tipo", "gasto")
      .gte("fecha", from)
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) return 0;
    candidates.push(...data);
    if (data.length < PAGE) break;
  }

  const already = new Set(candidates.filter((c) => c.es_recurrente).map((c) => c.id));
  const toMark = findRecurringIds(candidates).filter((id) => !already.has(id));

  for (let i = 0; i < toMark.length; i += 100) {
    await supabase
      .from("transactions")
      .update({ es_recurrente: true })
      .in("id", toMark.slice(i, i + 100));
  }
  return toMark.length;
}
