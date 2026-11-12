import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, askJson } from "@/lib/anthropic";
import { averageByCategory, type BudgetCategory, type BudgetTx } from "@/lib/budget";
import { CURRENCY, todayInTimezone } from "@/lib/config";
import { addDays, weekStart } from "@/lib/dates";
import { goalProgress, PACE_WEEKS, type Contribution, type Goal } from "@/lib/goals";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const AVERAGE_WEEKS = 4;

const bodySchema = z.object({ goal_id: z.uuid() });

const suggestionSchema = z.object({
  resumen: z.string(),
  recortes: z.array(
    z.object({
      categoria: z.string(),
      recorte_semanal: z.number(),
      como: z.string(),
    }),
  ),
});

const SYSTEM = `Ayudas a una persona a alcanzar una de sus metas de ahorro recortando gastos semanales.

Recibes cuánto le falta apartar por semana y su gasto semanal promedio por categoría frente al presupuesto.
Propón de dónde sacar la diferencia:
- Empieza por las categorías más excedidas respecto a su presupuesto.
- No propongas recortes en gastos fijos difíciles de cambiar a corto plazo (vivienda, servicios básicos, salud) salvo que no haya alternativa.
- "recorte_semanal": monto concreto por semana, mayor a 0 y nunca mayor al gasto promedio de esa categoría.
- "como": una acción concreta y realista en una frase (ej. "Cocina en casa dos de las cenas que hoy pides a domicilio").
- "categoria": el nombre exacto de una categoría de la lista. Como máximo 4 recortes.
- La suma de los recortes debe acercarse a lo que falta por semana sin pasarse; si no alcanza con recortes razonables, dilo en el resumen y sugiere mover la fecha objetivo.
- "resumen": dos frases como máximo, en español, directas y sin juicios.`;

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Meta no válida." }, { status: 400 });

  const supabase = await createClient();
  const today = todayInTimezone();
  const start = weekStart(today);
  const since = addDays(start, -7 * AVERAGE_WEEKS - 31);

  const [goalRes, contribRes, catRes] = await Promise.all([
    supabase.from("savings_goals").select("*").eq("id", body.data.goal_id).single(),
    supabase
      .from("savings_contributions")
      .select("goal_id, fecha, monto")
      .eq("goal_id", body.data.goal_id)
      .gt("fecha", addDays(today, -7 * PACE_WEEKS)),
    supabase.from("categories").select("id, nombre, presupuesto_mensual, color_neutro"),
  ]);
  if (!goalRes.data) return NextResponse.json({ error: "No encontré esa meta." }, { status: 404 });

  const goal = goalRes.data as Goal;
  const progress = goalProgress(goal, (contribRes.data ?? []) as Contribution[], today);
  if (progress.diferenciaSemanal <= 0) {
    return NextResponse.json({ error: "Con tu ritmo actual ya llegas a esta meta." }, { status: 422 });
  }

  let txs: BudgetTx[];
  try {
    txs = await fetchAll<BudgetTx>((from, to) =>
      supabase
        .from("transactions")
        .select("id, fecha, monto, category_id, es_recurrente, comercio, descripcion_original")
        .eq("tipo", "gasto")
        .gte("fecha", since)
        .lt("fecha", start)
        .order("id")
        .range(from, to),
    );
  } catch {
    return NextResponse.json({ error: "No pude leer tus gastos." }, { status: 500 });
  }

  const categories = (catRes.data ?? []) as BudgetCategory[];
  const averages = averageByCategory(categories, txs, start, AVERAGE_WEEKS, true).filter(
    (c) => c.promedio > 0,
  );
  if (averages.length === 0) {
    return NextResponse.json(
      { error: "Aún no hay gastos categorizados en las últimas semanas para analizar." },
      { status: 422 },
    );
  }

  try {
    const result = await askJson({
      schema: suggestionSchema,
      system: SYSTEM,
      effort: "low",
      maxTokens: 4000,
      content: [
        `Moneda: ${CURRENCY}. Meta: "${goal.nombre}".`,
        `Necesita apartar ${progress.porSemana} por semana y hoy aparta ${progress.ritmoSemanal}: faltan ${progress.diferenciaSemanal} por semana.`,
        `Gasto semanal promedio de las últimas ${AVERAGE_WEEKS} semanas (ordenado de más a menos excedido): ${JSON.stringify(
          averages.map(({ nombre, presupuesto, promedio, exceso }) => ({
            categoria: nombre,
            presupuesto_semanal: presupuesto,
            gasto_semanal_promedio: promedio,
            exceso_semanal: exceso,
          })),
        )}`,
      ].join("\n"),
    });

    // Solo categorías reales y recortes que no superen lo que de verdad se gasta.
    // Tampoco se propone recortar más de lo que hace falta.
    const byName = new Map(averages.map((c) => [c.nombre, c]));
    let restante = progress.diferenciaSemanal;
    const recortes: { categoria: string; recorte_semanal: number; como: string }[] = [];
    for (const r of result.recortes) {
      if (recortes.length >= 4 || restante <= 0) break;
      const category = byName.get(r.categoria);
      if (!category || !(r.recorte_semanal > 0)) continue;
      if (recortes.some((x) => x.categoria === r.categoria)) continue;
      const monto =
        Math.round(Math.min(r.recorte_semanal, category.promedio, restante) * 100) / 100;
      if (monto <= 0) continue;
      restante = Math.round((restante - monto) * 100) / 100;
      recortes.push({ categoria: r.categoria, recorte_semanal: monto, como: r.como.trim().slice(0, 240) });
    }

    return NextResponse.json({
      resumen: result.resumen.trim().slice(0, 500),
      recortes,
      total_semanal: Math.round(recortes.reduce((s, r) => s + r.recorte_semanal, 0) * 100) / 100,
      necesario_semanal: progress.diferenciaSemanal,
    });
  } catch (error) {
    const message = error instanceof AiError ? error.message : "No pude preparar la propuesta.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
