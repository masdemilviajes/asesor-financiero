import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ListChecks, Settings, type LucideIcon } from "lucide-react";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Más" };

type Item = { href: string; label: string; detail: string; icon: LucideIcon };

export default async function MasPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "gasto")
    .eq("requiere_revision", true);
  const pending = count ?? 0;

  const items: Item[] = [
    {
      href: "/revisar",
      label: "Por revisar",
      detail:
        pending > 0
          ? plural(pending, "gasto pendiente de categoría", "gastos pendientes de categoría")
          : "Nada pendiente",
      icon: ListChecks,
    },
    {
      href: "/ajustes",
      label: "Ajustes",
      detail: "Cuentas, categorías, presupuesto semanal y reglas",
      icon: Settings,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Más</h1>
      <ul className="divide-y rounded-xl border">
        {items.map(({ href, label, detail, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/60"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
