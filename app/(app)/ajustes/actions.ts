"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES, NEUTRAL_COLORS, type ActionState } from "@/lib/types";

const amount = z.preprocess(parseAmount, z.number({ error: "Escribe un monto válido." }));

const optionalDay = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().min(1, "El día va de 1 a 31.").max(31, "El día va de 1 a 31.").nullable(),
);

const accountSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la cuenta.").max(60),
  tipo: z.enum(ACCOUNT_TYPES),
  saldo_actual: amount,
  ultimos4: z.preprocess(
    (v) => (v === "" || v == null ? null : String(v).trim()),
    z
      .string()
      .regex(/^\d{4}$/, "Escribe solo los últimos 4 dígitos.")
      .nullable(),
  ),
  dia_corte: optionalDay,
  dia_limite_pago: optionalDay,
});

const categorySchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la categoría.").max(40),
  presupuesto_mensual: amount.pipe(z.number().min(0, "El presupuesto no puede ser negativo.")),
  color_neutro: z.enum(NEUTRAL_COLORS),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const values = parsed.data;
  // Corte y fecha límite solo aplican a tarjetas de crédito.
  if (values.tipo !== "credito") {
    values.dia_corte = null;
    values.dia_limite_pago = null;
  }

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("accounts").update(values).eq("id", id)
    : await supabase.from("accounts").insert(values);

  if (error) return { ok: false, error: "No se pudo guardar la cuenta." };
  revalidateAll();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la cuenta." };
  revalidateAll();
  return { ok: true };
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Ya tienes una categoría con ese nombre."
          : "No se pudo guardar la categoría.",
    };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la categoría." };
  revalidateAll();
  return { ok: true };
}
