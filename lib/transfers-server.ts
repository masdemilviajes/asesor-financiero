import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchRules, rulePattern } from "@/lib/categorize";
import { addDays } from "@/lib/dates";
import { isMissingMigration, loadRules, upsertRule } from "@/lib/rules-server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { looksLikeTransfer, PAIR_DAYS, pairTransfers, type PairCandidate } from "@/lib/transfers";

export type TransferResult = { count: number; missingMigration: boolean };

/** Convierte movimientos en transferencias: dejan de contar como gasto o ingreso. */
export async function setAsTransfer(supabase: SupabaseClient, ids: string[]): Promise<TransferResult> {
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await supabase
      .from("transactions")
      .update({
        tipo: "transferencia",
        category_id: null,
        requiere_revision: false,
        es_recurrente: false,
      })
      .in("id", unique.slice(i, i + 100));
    if (error) return { count: 0, missingMigration: isMissingMigration(error) };
  }
  return { count: unique.length, missingMigration: false };
}

type ImportedRow = {
  id: string;
  fecha: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  account_id: string | null;
  import_id: string | null;
  descripcion_original: string;
};

/**
 * Tras una importación, detecta los traspasos entre cuentas propias y las
 * conversiones de moneda:
 * 1) por las reglas aprendidas, 2) por palabras típicas de la descripción y
 * 3) emparejando una salida con una entrada del mismo monto en otra cuenta.
 */
export async function markTransfers(supabase: SupabaseClient, importId: string): Promise<TransferResult> {
  const { data: importedData } = await supabase
    .from("transactions")
    .select("id, fecha, monto, tipo, account_id, import_id, descripcion_original")
    .eq("import_id", importId)
    .in("tipo", ["gasto", "ingreso"])
    .limit(5000);
  const imported = (importedData ?? []) as ImportedRow[];
  if (imported.length === 0) return { count: 0, missingMigration: false };

  const rules = await loadRules(supabase);
  const ids = imported
    .filter(
      (row) =>
        matchRules(row.descripcion_original, rules)?.kind === "transferencia" ||
        looksLikeTransfer(row.descripcion_original),
    )
    .map((row) => row.id);

  // Emparejar contra lo que hay en las otras cuentas alrededor de esas fechas.
  const fechas = imported.map((row) => row.fecha).sort();
  let nearby: ImportedRow[] = [];
  try {
    nearby = await fetchAll<ImportedRow>((from, to) =>
      supabase
        .from("transactions")
        .select("id, fecha, monto, tipo, account_id, import_id, descripcion_original")
        .in("tipo", ["gasto", "ingreso"])
        .gte("fecha", addDays(fechas[0], -PAIR_DAYS))
        .lte("fecha", addDays(fechas[fechas.length - 1], PAIR_DAYS))
        .order("id")
        .range(from, to),
    );
  } catch {
    nearby = imported;
  }

  const already = new Set(ids);
  const candidates: PairCandidate[] = nearby
    .filter((row) => !already.has(row.id))
    .map((row) => ({
      id: row.id,
      fecha: row.fecha,
      monto: Number(row.monto),
      tipo: row.tipo,
      account_id: row.account_id,
      nuevo: row.import_id === importId,
    }));

  const all = [...ids, ...pairTransfers(candidates)];
  return all.length > 0 ? setAsTransfer(supabase, all) : { count: 0, missingMigration: false };
}

/**
 * Aprende que un tipo de movimiento es una transferencia y lo aplica a los
 * pendientes de revisar que coincidan. Devuelve cuántos más resolvió.
 */
export async function learnTransferRule(supabase: SupabaseClient, description: string): Promise<number> {
  const patron = rulePattern(description);
  if (!patron) return 0;

  const saved = await upsertRule(supabase, {
    patron_texto: patron,
    category_id: null,
    es_transferencia: true,
  });
  if (!saved) return 0;

  const { data: pending } = await supabase
    .from("transactions")
    .select("id, descripcion_original")
    .eq("tipo", "gasto")
    .eq("requiere_revision", true)
    .limit(1000);

  const rule = [{ patron_texto: patron, category_id: null, es_transferencia: true }];
  const ids = (pending ?? [])
    .filter((t) => matchRules(t.descripcion_original, rule)?.kind === "transferencia")
    .map((t) => t.id);
  if (ids.length === 0) return 0;
  return (await setAsTransfer(supabase, ids)).count;
}
