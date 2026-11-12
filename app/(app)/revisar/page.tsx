import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Category, TransactionWithRefs } from "@/lib/types";
import { ReviewList } from "./review-list";

export const metadata: Metadata = { title: "Por revisar" };

// La categorización con IA de muchos movimientos puede tardar.
export const maxDuration = 300;

export default async function RevisarPage() {
  const supabase = await createClient();
  const [txRes, categoriesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(nombre, color_neutro), accounts(nombre)")
      .eq("tipo", "gasto")
      .eq("requiere_revision", true)
      .order("fecha", { ascending: false })
      .limit(200),
    supabase.from("categories").select("id, nombre, color_neutro").order("nombre"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Por revisar</h1>
        <p className="text-sm text-muted-foreground">
          Gastos sin categoría o con una sugerencia dudosa. Toca la categoría correcta: la app
          aprende la regla y la próxima vez lo hará sola.
        </p>
      </div>
      <ReviewList
        transactions={(txRes.data ?? []) as TransactionWithRefs[]}
        categories={(categoriesRes.data ?? []) as Pick<Category, "id" | "nombre" | "color_neutro">[]}
      />
    </div>
  );
}
