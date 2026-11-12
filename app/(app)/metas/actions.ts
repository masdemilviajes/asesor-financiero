"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const money = (message: string) =>
  z.preprocess(parseAmount, z.number({ error: message }));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida.");

const goalSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la meta.").max(60),
  monto_objetivo: money("Escribe el monto objetivo.").pipe(
    z.number().positive("El objetivo debe ser mayor a cero."),
  ),
  monto_actual: money("Escribe cuánto llevas ahorrado.").pipe(
    z.number().min(0, "Lo ahorrado no puede ser negativo."),
  ),
  fecha_objetivo: date,
});

const contributionSchema = z.object({
  goal_id: z.uuid(),
  monto: money("Escribe el monto.").pipe(
    z.number().refine((n) => n !== 0, "El monto no puede ser cero."),
  ),
  fecha: date,
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

export async function saveGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("savings_goals").update(parsed.data).eq("id", id)
    : await supabase.from("savings_goals").insert(parsed.data);

  if (error) return { ok: false, error: "No se pudo guardar la meta." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la meta." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Registra una aportación (o un retiro, con monto negativo) y actualiza lo ahorrado. */
export async function addContribution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contributionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { goal_id, monto, fecha } = parsed.data;

  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("savings_goals")
    .select("monto_actual")
    .eq("id", goal_id)
    .single();
  if (!goal) return { ok: false, error: "No encontré esa meta." };

  const nuevo = Math.round((Number(goal.monto_actual) + monto) * 100) / 100;
  if (nuevo < 0) return { ok: false, error: "No puedes retirar más de lo que hay ahorrado." };

  const { error: insertError } = await supabase
    .from("savings_contributions")
    .insert({ goal_id, monto, fecha });
  if (insertError) return { ok: false, error: "No se pudo registrar la aportación." };

  const { error: updateError } = await supabase
    .from("savings_goals")
    .update({ monto_actual: nuevo })
    .eq("id", goal_id);
  if (updateError) return { ok: false, error: "Se registró la aportación, pero no se actualizó el total." };

  revalidatePath("/", "layout");
  return { ok: true };
}
