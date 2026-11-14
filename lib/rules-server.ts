import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rule } from "@/lib/categorize";

/** Aviso cuando la base de datos aún no tiene la migración 0004. */
export const MIGRATION_MESSAGE =
  "Para usar transferencias falta un paso en Supabase: ejecuta el SQL de supabase/migrations/0004_transferencias.sql en el SQL Editor.";

/** Errores que aparecen si falta la migración 0004 (restricción o columna inexistente). */
export function isMissingMigration(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23514" || error?.code === "PGRST204" || error?.code === "42703";
}

/** Reglas aprendidas. Funciona también si la migración 0004 aún no se ejecutó. */
export async function loadRules(supabase: SupabaseClient): Promise<Rule[]> {
  const { data } = await supabase.from("categorization_rules").select("*");
  return (data ?? []) as Rule[];
}

/** Crea o actualiza la regla de un patrón. Devuelve false si falta la migración. */
export async function upsertRule(
  supabase: SupabaseClient,
  rule: { patron_texto: string; category_id: string | null; es_transferencia: boolean },
): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const { error } = await supabase
    .from("categorization_rules")
    .upsert({ ...rule, updated_at }, { onConflict: "user_id,patron_texto" });
  if (!error) return true;
  if (!isMissingMigration(error) || rule.es_transferencia || !rule.category_id) return false;

  // Sin la migración 0004 todavía se pueden guardar reglas de categoría.
  const retry = await supabase
    .from("categorization_rules")
    .upsert(
      { patron_texto: rule.patron_texto, category_id: rule.category_id, updated_at },
      { onConflict: "user_id,patron_texto" },
    );
  return !retry.error;
}
