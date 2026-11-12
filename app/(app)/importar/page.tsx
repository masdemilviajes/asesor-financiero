import type { Metadata } from "next";
import { todayInTimezone } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Account, Category } from "@/lib/types";
import { ImportTabs } from "./import-tabs";

export const metadata: Metadata = { title: "Importar" };

// Leer un PDF con IA puede tardar; da margen a las acciones de esta pantalla.
export const maxDuration = 300;

export default async function ImportarPage() {
  const supabase = await createClient();
  const [userRes, accountsRes, categoriesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("accounts").select("id, nombre").order("created_at"),
    supabase.from("categories").select("id, nombre").order("nombre"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
        <p className="text-sm text-muted-foreground">
          Agrega movimientos escribiendo una línea o subiendo un archivo de tu banco.
        </p>
      </div>
      <ImportTabs
        userId={userRes.data.user?.id ?? ""}
        today={todayInTimezone()}
        accounts={(accountsRes.data ?? []) as Pick<Account, "id" | "nombre">[]}
        categories={(categoriesRes.data ?? []) as Pick<Category, "id" | "nombre">[]}
      />
    </div>
  );
}
