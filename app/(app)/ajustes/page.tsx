import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { monthlyToWeekly } from "@/lib/budget";
import { formatMoney } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPE_LABELS, type Account, type Category } from "@/lib/types";
import { AccountDialog } from "./account-dialog";
import { CategoryDialog } from "./category-dialog";
import { RulesCard, type RuleRow } from "./rules-card";

export const metadata: Metadata = { title: "Ajustes" };

const ROW =
  "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60";

export default async function AjustesPage() {
  const supabase = await createClient();
  const [accountsRes, categoriesRes, rulesRes] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("categories").select("*").order("nombre"),
    supabase
      .from("categorization_rules")
      .select("*, categories(nombre)")
      .order("patron_texto"),
  ]);
  const rules: RuleRow[] = ((rulesRes.data ?? []) as unknown as {
    id: string;
    patron_texto: string;
    es_transferencia?: boolean;
    categories: { nombre: string } | null;
  }[]).map((r) => ({
    id: r.id,
    patron_texto: r.patron_texto,
    categoria: r.es_transferencia ? "Transferencia (no cuenta)" : (r.categories?.nombre ?? "—"),
  }));
  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const presupuestoTotal = categories.reduce(
    (s, c) => s + monthlyToWeekly(c.presupuesto_mensual),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Tus cuentas y categorías de gasto.</p>
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
          <CardDescription>Toca una cuenta para editarla o actualizar su saldo.</CardDescription>
          <CardAction>
            <AccountDialog>
              <Button variant="outline" size="lg">
                <Plus aria-hidden /> Agregar
              </Button>
            </AccountDialog>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {accounts.length === 0 ? (
            <p className="px-4 pb-4 text-muted-foreground">Aún no tienes cuentas.</p>
          ) : (
            <ul className="divide-y border-t">
              {accounts.map((account) => (
                <li key={account.id}>
                  <AccountDialog account={account}>
                    <button type="button" className={ROW}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{account.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {ACCOUNT_TYPE_LABELS[account.tipo]}
                          {account.ultimos4 ? ` ·· ${account.ultimos4}` : ""}
                          {account.tipo === "credito" && account.dia_limite_pago
                            ? ` · paga el día ${account.dia_limite_pago}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(account.saldo_actual)}
                      </span>
                    </button>
                  </AccountDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>
            Presupuesto semanal total: {formatMoney(presupuestoTotal)}
          </CardDescription>
          <CardAction>
            <CategoryDialog>
              <Button variant="outline" size="lg">
                <Plus aria-hidden /> Agregar
              </Button>
            </CategoryDialog>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {categories.length === 0 ? (
            <p className="px-4 pb-4 text-muted-foreground">Aún no tienes categorías.</p>
          ) : (
            <ul className="divide-y border-t">
              {categories.map((category) => (
                <li key={category.id}>
                  <CategoryDialog category={category}>
                    <button type="button" className={ROW}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: category.color_neutro }}
                        />
                        <span className="truncate font-medium">{category.nombre}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatMoney(monthlyToWeekly(category.presupuesto_mensual))} / semana
                      </span>
                    </button>
                  </CategoryDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RulesCard rules={rules} />
    </div>
  );
}
