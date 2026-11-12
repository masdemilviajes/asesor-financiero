import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, todayInTimezone } from "@/lib/config";
import { addMonths, formatDay, formatMonth, isValidMonth, monthRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Account, Category, TransactionWithRefs } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddTransaction } from "./add-transaction";
import { TransactionRow } from "./transaction-row";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const today = todayInTimezone();
  const currentMonth = today.slice(0, 7);
  const mes = isValidMonth(params.mes) ? params.mes : currentMonth;
  const { start, end } = monthRange(mes);

  const supabase = await createClient();
  const [txRes, accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(nombre, color_neutro), accounts(nombre)")
      .gte("fecha", start)
      .lt("fecha", end)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("accounts").select("id, nombre").order("created_at"),
    supabase.from("categories").select("id, nombre").order("nombre"),
  ]);

  const transactions = (txRes.data ?? []) as TransactionWithRefs[];
  const accounts = (accountsRes.data ?? []) as Pick<Account, "id" | "nombre">[];
  const categories = (categoriesRes.data ?? []) as Pick<Category, "id" | "nombre">[];

  const gastos = transactions
    .filter((t) => t.tipo === "gasto")
    .reduce((s, t) => s + Number(t.monto), 0);
  const ingresos = transactions
    .filter((t) => t.tipo === "ingreso")
    .reduce((s, t) => s + Number(t.monto), 0);

  // Agrupa por día, conservando el orden (más reciente primero).
  const byDay = new Map<string, TransactionWithRefs[]>();
  for (const t of transactions) {
    const list = byDay.get(t.fecha) ?? [];
    list.push(t);
    byDay.set(t.fecha, list);
  }

  const navButton = cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "size-10");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground">Toca un movimiento para editarlo.</p>
        </div>
        <AddTransaction today={today} accounts={accounts} categories={categories} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/movimientos?mes=${addMonths(mes, -1)}`}
          className={navButton}
          aria-label="Mes anterior"
        >
          <ChevronLeft aria-hidden />
        </Link>
        <span className="inline-block font-medium first-letter:uppercase">{formatMonth(mes)}</span>
        {mes < currentMonth ? (
          <Link
            href={`/movimientos?mes=${addMonths(mes, 1)}`}
            className={navButton}
            aria-label="Mes siguiente"
          >
            <ChevronRight aria-hidden />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Gastos</CardDescription>
            <CardTitle className="text-lg tabular-nums">{formatMoney(gastos)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Ingresos</CardDescription>
            <CardTitle className="text-lg tabular-nums">{formatMoney(ingresos)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {txRes.error ? (
        <p role="alert" className="text-sm font-medium">
          No pude cargar los movimientos: {txRes.error.message}
        </p>
      ) : transactions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No hay movimientos en {formatMonth(mes)}.
        </p>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            {[...byDay.entries()].map(([fecha, list]) => (
              <section key={fecha}>
                <h2 className="border-b bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground first-letter:uppercase">
                  {formatDay(fecha)}
                </h2>
                <ul className="divide-y border-b last:border-b-0">
                  {list.map((t) => (
                    <li key={t.id}>
                      <TransactionRow transaction={t} accounts={accounts} categories={categories} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
