"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categorizePending, learnRule, type CategorizeSummary } from "@/lib/categorize-server";
import { MIGRATION_MESSAGE } from "@/lib/rules-server";
import { createClient } from "@/lib/supabase/server";
import { learnTransferRule, setAsTransfer } from "@/lib/transfers-server";

const idSchema = z.uuid();

/** Valor especial de resolveReview para marcar un movimiento como transferencia. */
const TRANSFER = "transferencia";

export type ResolveResult = { ok: true; extra: number } | { ok: false; error: string };

/**
 * Corrección con un clic: asigna la categoría, saca el movimiento de la
 * bandeja y aprende una regla para la próxima vez.
 */
export async function resolveReview(
  transactionId: string,
  categoryId: string | null,
): Promise<ResolveResult> {
  if (!idSchema.safeParse(transactionId).success) return { ok: false, error: "Movimiento no válido." };
  if (categoryId !== null && categoryId !== TRANSFER && !idSchema.safeParse(categoryId).success) {
    return { ok: false, error: "Categoría no válida." };
  }

  const supabase = await createClient();

  // "Es transferencia": deja de contar como gasto y se aprende la regla.
  if (categoryId === TRANSFER) {
    const { data: row } = await supabase
      .from("transactions")
      .select("descripcion_original")
      .eq("id", transactionId)
      .single();
    if (!row) return { ok: false, error: "No encontré ese movimiento." };
    const moved = await setAsTransfer(supabase, [transactionId]);
    if (moved.count === 0) {
      return {
        ok: false,
        error: moved.missingMigration ? MIGRATION_MESSAGE : "No se pudo guardar el cambio.",
      };
    }
    const extra = await learnTransferRule(supabase, row.descripcion_original);
    revalidatePath("/", "layout");
    return { ok: true, extra: extra + 1 };
  }

  const { data: tx, error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId, requiere_revision: false })
    .eq("id", transactionId)
    .select("descripcion_original")
    .single();
  if (error || !tx) return { ok: false, error: "No se pudo guardar la categoría." };

  // "Sin categoría" no enseña ninguna regla.
  const extra = categoryId ? await learnRule(supabase, tx.descripcion_original, categoryId) : 0;

  revalidatePath("/", "layout");
  return { ok: true, extra };
}

export type CategorizeResult =
  | ({ ok: true } & CategorizeSummary)
  | { ok: false; error: string };

/** Aplica reglas e IA a todos los gastos pendientes. */
export async function runCategorization(): Promise<CategorizeResult> {
  try {
    const supabase = await createClient();
    const summary = await categorizePending(supabase);
    revalidatePath("/", "layout");
    return { ok: true, ...summary };
  } catch {
    return { ok: false, error: "No se pudo categorizar. Inténtalo de nuevo." };
  }
}

export async function deleteRule(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("categorization_rules").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la regla." };
  revalidatePath("/", "layout");
  return { ok: true };
}
