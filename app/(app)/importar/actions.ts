"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { existingHashes, markRecurring, withHashes } from "@/lib/import/server";
import { createClient } from "@/lib/supabase/server";

const rowSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descripcion: z.string().trim().min(1).max(500),
  monto: z.number().positive().max(1_000_000_000),
  tipo: z.enum(["gasto", "ingreso"]),
});

const rowsSchema = z.array(rowSchema).min(1).max(3000);

export type PreviewRow = z.infer<typeof rowSchema> & { duplicado: boolean };

export type PreviewResult =
  | { ok: true; rows: PreviewRow[] }
  | { ok: false; error: string };

/** Prepara la vista previa: oculta números sensibles y marca lo que ya existe. */
export async function previewImport(input: unknown): Promise<PreviewResult> {
  const parsed = rowsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "No encontré movimientos válidos (máximo 3,000 por archivo)." };
  }

  const rows = withHashes(parsed.data);
  const fechas = rows.map((r) => r.fecha).sort();
  const supabase = await createClient();

  try {
    const existing = await existingHashes(supabase, fechas[0], fechas[fechas.length - 1]);
    return {
      ok: true,
      rows: rows.map(({ hash_unico, ...row }) => ({ ...row, duplicado: existing.has(hash_unico) })),
    };
  } catch {
    return { ok: false, error: "No pude revisar los duplicados. Inténtalo de nuevo." };
  }
}

const confirmSchema = z.object({
  rows: rowsSchema,
  account_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable()),
  nombre_archivo: z.string().trim().min(1).max(200),
  import_id: z.uuid().nullable().optional(),
});

export type ConfirmResult =
  | { ok: true; guardados: number; duplicados: number; recurrentes: number }
  | { ok: false; error: string };

/** Guarda los movimientos confirmados, descartando los duplicados. */
export async function confirmImport(input: unknown): Promise<ConfirmResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Los datos a importar no son válidos." };

  const { account_id, nombre_archivo } = parsed.data;
  const rows = withHashes(parsed.data.rows);
  const supabase = await createClient();

  // Registro de la importación (los PDF ya lo traen creado).
  let importId = parsed.data.import_id ?? null;
  if (!importId) {
    const { data, error } = await supabase
      .from("imports")
      .insert({ nombre_archivo, estado: "procesando", movimientos_detectados: rows.length })
      .select("id")
      .single();
    if (error) return { ok: false, error: "No se pudo registrar la importación." };
    importId = data.id;
  }

  let guardados = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((row) => ({
      account_id,
      import_id: importId,
      fecha: row.fecha,
      descripcion_original: row.descripcion,
      comercio: null,
      monto: row.monto,
      tipo: row.tipo,
      category_id: null,
      // Los gastos quedan pendientes de categorizar (fase de categorización).
      requiere_revision: row.tipo === "gasto",
      hash_unico: row.hash_unico,
    }));
    const { data, error } = await supabase
      .from("transactions")
      .upsert(chunk, { onConflict: "user_id,hash_unico", ignoreDuplicates: true })
      .select("id");
    if (error) {
      await supabase.from("imports").update({ estado: "error" }).eq("id", importId);
      return { ok: false, error: "No se pudieron guardar los movimientos." };
    }
    guardados += data.length;
  }

  await supabase
    .from("imports")
    .update({ estado: "confirmado", movimientos_detectados: rows.length })
    .eq("id", importId);

  const recurrentes = await markRecurring(supabase);
  revalidatePath("/", "layout");
  return { ok: true, guardados, duplicados: rows.length - guardados, recurrentes };
}
