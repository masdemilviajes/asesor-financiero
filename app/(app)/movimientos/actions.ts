"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@/lib/format";
import { forcedDuplicateHash, transactionHash } from "@/lib/hash";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);

const transactionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida."),
  descripcion: z.string().trim().min(1, "Escribe una descripción.").max(200),
  monto: z.preprocess(
    parseAmount,
    z.number({ error: "Escribe un monto válido." }).positive("El monto debe ser mayor a cero."),
  ),
  tipo: z.enum(["gasto", "ingreso"]),
  account_id: optionalId,
  category_id: optionalId,
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Captura manual de un movimiento. */
export async function addTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { fecha, descripcion, monto, tipo, account_id, category_id } = parsed.data;
  const forzar = formData.get("forzar") === "1";

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    fecha,
    descripcion_original: descripcion,
    comercio: descripcion,
    monto,
    tipo,
    account_id,
    category_id,
    // Un gasto sin categoría queda pendiente en la bandeja "Por revisar".
    requiere_revision: tipo === "gasto" && !category_id,
    hash_unico: forzar
      ? forcedDuplicateHash(fecha, monto, descripcion)
      : transactionHash(fecha, monto, descripcion),
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        duplicate: true,
        error: "Ya registraste un movimiento con la misma fecha, monto y descripción.",
      };
    }
    return { ok: false, error: "No se pudo guardar el movimiento." };
  }

  revalidateAll();
  return { ok: true };
}

/** Edita un movimiento existente. */
export async function updateTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!id || !parsed.success) {
    return { ok: false, error: parsed.success ? "Falta el movimiento." : firstError(parsed.error) };
  }

  const { fecha, descripcion, monto, tipo, account_id, category_id } = parsed.data;
  const supabase = await createClient();

  // La huella se calcula con la descripción original, que no se edita.
  const { data: current } = await supabase
    .from("transactions")
    .select("descripcion_original, fecha, monto")
    .eq("id", id)
    .single();
  if (!current) return { ok: false, error: "No encontré ese movimiento." };

  const changedKey = current.fecha !== fecha || Number(current.monto) !== monto;

  const { error } = await supabase
    .from("transactions")
    .update({
      fecha,
      comercio: descripcion,
      monto,
      tipo,
      account_id,
      category_id,
      requiere_revision: tipo === "gasto" && !category_id,
      ...(changedKey
        ? { hash_unico: transactionHash(fecha, monto, current.descripcion_original) }
        : {}),
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Ya existe otro movimiento con esa fecha, monto y descripción."
          : "No se pudo guardar el movimiento.",
    };
  }

  revalidateAll();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar el movimiento." };
  revalidateAll();
  return { ok: true };
}
