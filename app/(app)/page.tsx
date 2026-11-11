import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/config";
import { createClient, getUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();

  // Comprobación de la fase (a): la base de datos responde y RLS deja ver
  // solo mis filas.
  const [accounts, categories, transactions] = await Promise.all([
    supabase.from("accounts").select("saldo_actual"),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  const dbError = accounts.error ?? categories.error ?? transactions.error;
  const saldoTotal = (accounts.data ?? []).reduce(
    (sum, a) => sum + Number(a.saldo_actual ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-sm text-muted-foreground">Sesión iniciada como {user?.email}</p>
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle>Falta preparar la base de datos</CardTitle>
            <CardDescription>
              No pude leer las tablas. Revisa que hayas ejecutado las migraciones de la carpeta
              supabase/migrations en el editor SQL de Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">
            {dbError.message}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Saldo en cuentas</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatMoney(saldoTotal)}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {accounts.data?.length ?? 0} cuentas
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Categorías</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{categories.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">con presupuesto mensual</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Movimientos</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{transactions.count ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">registrados</CardContent>
          </Card>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        El dashboard de presupuesto llega en la fase (e). Por ahora esta pantalla confirma que el
        login y la base de datos funcionan.
      </p>
    </div>
  );
}
