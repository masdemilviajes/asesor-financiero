import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AiError, askJson } from "@/lib/anthropic";
import { applyRules, matchRules, rulePattern } from "@/lib/categorize";
import { CURRENCY } from "@/lib/config";
import { loadRules, upsertRule } from "@/lib/rules-server";
import { setAsTransfer } from "@/lib/transfers-server";

const BATCH_SIZE = 60; // movimientos por llamada a la IA
const MAX_PER_RUN = 600;

const aiSchema = z.object({
  resultados: z.array(
    z.object({
      indice: z.number(),
      categoria_id: z.string().nullable(),
      confianza: z.enum(["alta", "media", "baja"]),
      comercio: z.string(),
      es_transferencia: z.boolean(),
    }),
  ),
});

const SYSTEM = `Clasificas gastos personales en las categorías que el usuario ya tiene definidas.

Para cada movimiento devuelve:
- "indice": el mismo índice que recibiste.
- "categoria_id": el id de la categoría que mejor corresponde, tomado de la lista; null si ninguna encaja.
- "confianza": "alta" si el comercio y la categoría son evidentes; "media" si es probable; "baja" si es una suposición (transferencias a personas, textos crípticos, comercios desconocidos, pagos genéricos).
- "comercio": nombre corto y legible del comercio, sin números de sucursal, ciudades ni códigos ("WOOLWORTHS 1294 SYDNEY" → "Woolworths"). Si no se reconoce, deja la descripción limpia.

- "es_transferencia": true solo si el movimiento NO es un gasto real sino dinero que el usuario mueve entre sus propias cuentas (las de la lista "Cuentas del usuario"), el pago de su propia tarjeta de crédito, o una conversión de moneda. Un pago o transferencia a otra persona o a un comercio es un gasto: false. En caso de duda, false con confianza "baja". Si es true, pon "categoria_id" en null.

Usa solo ids de la lista de categorías. Devuelve un resultado por cada movimiento recibido.`;

type Pending = {
  id: string;
  descripcion_original: string;
  comercio: string | null;
  monto: number;
  fecha: string;
};

export type CategorizeSummary = {
  porReglas: number;
  porIA: number;
  porRevisar: number;
  /** Marcados como transferencia (no cuentan como gasto). */
  transferencias: number;
  /** Mensaje si la IA no pudo usarse (las reglas se aplican igual). */
  aviso?: string;
};

/**
 * Categoriza los gastos sin categoría:
 * 1) aplica las reglas aprendidas, 2) manda el resto en lotes a la IA,
 * 3) deja en "Por revisar" lo que tenga confianza baja o no encaje.
 */
export async function categorizePending(supabase: SupabaseClient): Promise<CategorizeSummary> {
  const summary: CategorizeSummary = { porReglas: 0, porIA: 0, porRevisar: 0, transferencias: 0 };

  const [{ data: pendingData }, { data: categories }, { data: accounts }, rules] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, descripcion_original, comercio, monto, fecha")
      .eq("tipo", "gasto")
      .is("category_id", null)
      .eq("requiere_revision", true)
      .order("fecha", { ascending: false })
      .limit(MAX_PER_RUN),
    supabase.from("categories").select("id, nombre").order("nombre"),
    supabase.from("accounts").select("nombre, tipo"),
    loadRules(supabase),
  ]);

  const pending = (pendingData ?? []) as Pending[];
  if (pending.length === 0 || !categories || categories.length === 0) return summary;

  // 1) Reglas
  const byCategory = new Map<string, string[]>();
  const forAi: Pending[] = [];
  const transferIds: string[] = [];
  for (const t of pending) {
    const match = matchRules(t.descripcion_original, rules);
    if (match?.kind === "transferencia") {
      transferIds.push(t.id);
      continue;
    }
    const categoryId = match?.kind === "categoria" ? match.category_id : null;
    if (categoryId) byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), t.id]);
    // "comercio" vacío = la IA todavía no lo ha visto. Así no se vuelve a
    // enviar (ni a cobrar) lo que ya revisó y dejó sin categoría.
    else if (t.comercio === null) forAi.push(t);
    else summary.porRevisar++;
  }
  for (const [categoryId, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 100) {
      await supabase
        .from("transactions")
        .update({ category_id: categoryId, requiere_revision: false })
        .in("id", ids.slice(i, i + 100));
    }
    summary.porReglas += ids.length;
  }

  if (transferIds.length > 0) {
    const result = await setAsTransfer(supabase, transferIds);
    summary.transferencias += result.count;
    if (result.count === 0) summary.porRevisar += transferIds.length;
  }

  // 2) IA, en lotes y en paralelo
  const validIds = new Set(categories.map((c) => c.id));
  const batches: Pending[][] = [];
  for (let i = 0; i < forAi.length; i += BATCH_SIZE) batches.push(forAi.slice(i, i + BATCH_SIZE));

  const results = await Promise.allSettled(
    batches.map((batch) =>
      askJson({
        schema: aiSchema,
        system: SYSTEM,
        effort: "low",
        maxTokens: 16000,
        content: [
          `Moneda: ${CURRENCY}.`,
          `Categorías: ${JSON.stringify(categories)}`,
          `Cuentas del usuario: ${JSON.stringify(accounts ?? [])}`,
          `Movimientos: ${JSON.stringify(
            batch.map((t, indice) => ({
              indice,
              descripcion: t.descripcion_original,
              monto: Number(t.monto),
              fecha: t.fecha,
            })),
          )}`,
        ].join("\n"),
      }),
    ),
  );

  for (const [b, result] of results.entries()) {
    const batch = batches[b];
    if (result.status === "rejected") {
      summary.porRevisar += batch.length;
      summary.aviso =
        result.reason instanceof AiError
          ? result.reason.message
          : "La IA no pudo categorizar algunos movimientos.";
      continue;
    }

    const seen = new Set<number>();
    for (const r of result.value.resultados) {
      const t = batch[r.indice];
      if (!t || seen.has(r.indice)) continue;
      seen.add(r.indice);

      // Traspaso propio o conversión de moneda: no es un gasto.
      if (r.es_transferencia && r.confianza !== "baja") {
        const moved = await setAsTransfer(supabase, [t.id]);
        if (moved.count > 0) {
          summary.transferencias++;
          continue;
        }
      }

      const categoryId = r.categoria_id && validIds.has(r.categoria_id) ? r.categoria_id : null;
      // 3) Confianza baja o sin categoría: se queda en la bandeja "Por revisar".
      const needsReview = !categoryId || r.confianza === "baja";
      await supabase
        .from("transactions")
        .update({
          category_id: categoryId,
          requiere_revision: needsReview,
          comercio: r.comercio.trim().slice(0, 80) || t.descripcion_original.slice(0, 80),
        })
        .eq("id", t.id);
      if (needsReview) summary.porRevisar++;
      else summary.porIA++;
    }
    summary.porRevisar += batch.length - seen.size;
  }

  return summary;
}

/**
 * Guarda (o actualiza) la regla aprendida de una corrección y la aplica a los
 * demás movimientos pendientes que coincidan. Devuelve cuántos más resolvió.
 */
export async function learnRule(
  supabase: SupabaseClient,
  description: string,
  categoryId: string,
): Promise<number> {
  const patron = rulePattern(description);
  if (!patron) return 0;

  await upsertRule(supabase, { patron_texto: patron, category_id: categoryId, es_transferencia: false });

  const { data: pending } = await supabase
    .from("transactions")
    .select("id, descripcion_original")
    .eq("tipo", "gasto")
    .eq("requiere_revision", true)
    .limit(1000);

  const rule = [{ patron_texto: patron, category_id: categoryId }];
  const ids = (pending ?? [])
    .filter((t) => applyRules(t.descripcion_original, rule) === categoryId)
    .map((t) => t.id);

  for (let i = 0; i < ids.length; i += 100) {
    await supabase
      .from("transactions")
      .update({ category_id: categoryId, requiere_revision: false })
      .in("id", ids.slice(i, i + 100));
  }
  return ids.length;
}

/** Categoría según las reglas para un movimiento nuevo (captura manual). */
export async function categoryFromRules(
  supabase: SupabaseClient,
  description: string,
): Promise<string | null> {
  return applyRules(description, await loadRules(supabase));
}
