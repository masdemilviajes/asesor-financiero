import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, askJson } from "@/lib/anthropic";
import { CURRENCY, TIMEZONE, todayInTimezone } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({ texto: z.string().trim().min(2).max(300) });

const quickSchema = z.object({
  entendido: z.boolean(),
  monto: z.number(),
  descripcion: z.string(),
  tipo: z.enum(["gasto", "ingreso"]),
  fecha: z.string(),
  cuenta_id: z.string().nullable(),
  categoria_id: z.string().nullable(),
});

const SYSTEM = `Interpretas una línea de captura rápida de un movimiento personal de dinero y devuelves sus datos.

- "monto": número positivo, sin símbolos.
- "descripcion": corta, con mayúscula inicial y sin el monto ni la cuenta (ej. "Súper").
- "tipo": "gasto" por defecto; "ingreso" solo si el texto habla de cobrar, recibir, sueldo, depósito, reembolso o similar.
- "fecha": YYYY-MM-DD. Usa la fecha de hoy salvo que el texto diga otra ("ayer", "el lunes", "3 de mayo").
- "cuenta_id": el id de la cuenta que mejor coincide con lo que dice el texto ("con débito", "en efectivo", "tarjeta"), o null si no la menciona.
- "categoria_id": el id de la categoría más adecuada de la lista, o null si ninguna encaja con claridad.
- "entendido": false si el texto no contiene un monto o no describe un movimiento; en ese caso pon monto 0.
Usa únicamente ids que aparezcan en las listas.`;

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Escribe algo como: 350 súper con débito" }, { status: 400 });
  }

  const supabase = await createClient();
  const [accounts, categories] = await Promise.all([
    supabase.from("accounts").select("id, nombre, tipo").order("created_at"),
    supabase.from("categories").select("id, nombre").order("nombre"),
  ]);
  const today = todayInTimezone();

  try {
    const result = await askJson({
      schema: quickSchema,
      system: SYSTEM,
      effort: "low",
      maxTokens: 4000,
      content: [
        `Hoy es ${today} (zona horaria ${TIMEZONE}). Moneda: ${CURRENCY}.`,
        `Cuentas: ${JSON.stringify(accounts.data ?? [])}`,
        `Categorías: ${JSON.stringify(categories.data ?? [])}`,
        `Texto del usuario: <captura>${body.data.texto}</captura>`,
      ].join("\n"),
    });

    if (!result.entendido || !(result.monto > 0)) {
      return NextResponse.json(
        { error: "No entendí el movimiento. Incluye el monto, por ejemplo: 350 súper con débito" },
        { status: 422 },
      );
    }

    // Solo se aceptan ids que existan de verdad y fechas con formato válido.
    const accountIds = new Set((accounts.data ?? []).map((a) => a.id));
    const categoryIds = new Set((categories.data ?? []).map((c) => c.id));
    return NextResponse.json({
      monto: Math.round(result.monto * 100) / 100,
      descripcion: result.descripcion.trim().slice(0, 200) || body.data.texto,
      tipo: result.tipo,
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(result.fecha) ? result.fecha : today,
      account_id: result.cuenta_id && accountIds.has(result.cuenta_id) ? result.cuenta_id : null,
      category_id:
        result.categoria_id && categoryIds.has(result.categoria_id) ? result.categoria_id : null,
    });
  } catch (error) {
    const message = error instanceof AiError ? error.message : "No pude interpretar el texto.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
