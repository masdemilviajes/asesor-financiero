import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryWeekCard } from "@/components/category-week-card";
import { BudgetBars } from "@/components/charts/budget-bars";
import { HistoryBars } from "@/components/charts/history-bars";
import { SpendingPie, type PieSlice } from "@/components/charts/spending-pie";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  spendByCategory,
  weekSummary,
  weeklyHistory,
  type BudgetCategory,
  type BudgetTx,
} from "@/lib/budget";
import { CATEGORY_COLORS, OTHER_COLOR } from "@/lib/chart-colors";
import { formatMoney, todayInTimezone } from "@/lib/config";
import { addDays, formatShortDay, formatWeek, isValidDate, weekStart } from "@/lib/dates";
import { plural } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const HISTORY_WEEKS = 12;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; fijos?: string }>;
}) {
  const params = await searchParams;
  const today = todayInTimezone();
  const currentWeek = weekStart(today);
  const requested = isValidDate(params.semana) ? weekStart(params.semana) : currentWeek;
  const start = requested > currentWeek ? currentWeek : requested;
  const end = addDays(start, 7);
  const isCurrentWeek = start === currentWeek;
  const prorate = params.fijos !== "reales";

  const supabase = await createClient();
  // Para repartir cargos fijos hacen falta los del mes anterior a la primera semana.
  const since = addDays(start, -7 * (HISTORY_WEEKS - 1) - 31);

  let dbError: string | null = null;
  let categories: BudgetCategory[] = [];
  let txs: BudgetTx[] = [];
  let ingresos = 0;
  let aportado = 0;
  let pendientes = 0;

  try {
    const [catRes, gastos, incomeRes, contribRes, pendingRes] = await Promise.all([
      // Por orden de creación: así cada categoría conserva siempre su color.
      supabase
        .from("categories")
        .select("id, nombre, presupuesto_mensual, color_neutro")
        .order("created_at")
        .order("id"),
      fetchAll<BudgetTx>((from, to) =>
        supabase
          .from("transactions")
          .select("id, fecha, monto, category_id, es_recurrente, comercio, descripcion_original")
          .eq("tipo", "gasto")
          .gte("fecha", since)
          .lt("fecha", end)
          .order("id")
          .range(from, to),
      ),
      supabase.from("transactions").select("monto").eq("tipo", "ingreso").gte("fecha", start).lt("fecha", end),
      supabase.from("savings_contributions").select("monto").gte("fecha", start).lt("fecha", end),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "gasto")
        .eq("requiere_revision", true),
    ]);
    if (catRes.error) throw new Error(catRes.error.message);
    categories = (catRes.data ?? []) as BudgetCategory[];
    txs = gastos;
    ingresos = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.monto), 0);
    aportado = (contribRes.data ?? []).reduce((s, r) => s + Number(r.monto), 0);
    pendientes = pendingRes.count ?? 0;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Error desconocido";
  }

  const summary = weekSummary(categories, txs, { start, today, prorate });
  const history = weeklyHistory(txs, start, HISTORY_WEEKS, prorate);
  const exceeded = summary.categorias.filter((c) => c.estado === "excedido").length;
  const atRisk = summary.categorias.filter((c) => c.estado === "en_riesgo").length;
  const totalDiff = summary.gastado - summary.presupuesto;
  const noBudget = categories.length > 0 && summary.presupuesto === 0;

  // Gráfico de sectores: un color fijo por categoría; de la novena en adelante, "Otras".
  const pieSlices = (weeks: number): PieSlice[] => {
    const spend = spendByCategory(categories, txs, start, weeks, prorate);
    const main = spend.slice(0, CATEGORY_COLORS.length).map((c, i) => ({ ...c, color: CATEGORY_COLORS[i] }));
    const rest = spend.slice(CATEGORY_COLORS.length).reduce((sum, c) => sum + c.total, 0);
    return rest > 0
      ? [...main, { id: "otras", nombre: "Otras", total: Math.round(rest * 100) / 100, color: OTHER_COLOR }]
      : main;
  };

  const query = (semana: string, fijos: boolean) => {
    const q = new URLSearchParams();
    if (semana !== currentWeek) q.set("semana", semana);
    if (!fijos) q.set("fijos", "reales");
    const text = q.toString();
    return text ? `/?${text}` : "/";
  };
  const navButton = cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "size-10");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link href={query(addDays(start, -7), prorate)} className={navButton} aria-label="Semana anterior">
          <ChevronLeft aria-hidden />
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {isCurrentWeek
              ? "Esta semana"
              : start === addDays(currentWeek, -7)
                ? "Semana pasada"
                : "Semana anterior"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatWeek(start)}
            {isCurrentWeek ? ` · ${Math.round(summary.elapsed * 100)}% transcurrido` : ""}
          </p>
        </div>
        {isCurrentWeek ? (
          <span className="size-10" />
        ) : (
          <Link href={query(addDays(start, 7), prorate)} className={navButton} aria-label="Semana siguiente">
            <ChevronRight aria-hidden />
          </Link>
        )}
      </div>

      {dbError ? (
        <Card>
          <CardHeader>
            <CardTitle>No pude leer tus datos</CardTitle>
            <CardDescription>
              Revisa que las migraciones de supabase/migrations estén ejecutadas en Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">{dbError}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card size="sm">
              <CardHeader>
                <CardDescription>Gastado</CardDescription>
                <CardTitle className="text-xl tabular-nums">{formatMoney(summary.gastado)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {noBudget
                  ? "en gastos con categoría"
                  : `de ${formatMoney(summary.presupuesto)} de presupuesto`}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>
                  {noBudget ? "Presupuesto" : totalDiff > 0 ? "De más" : "Disponible"}
                </CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {noBudget ? "Sin definir" : formatMoney(Math.abs(totalDiff))}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {noBudget
                  ? "ponlo en Ajustes"
                  : exceeded > 0
                  ? plural(exceeded, "categoría excedida", "categorías excedidas")
                  : atRisk > 0
                    ? plural(atRisk, "categoría en riesgo", "categorías en riesgo")
                    : "todo dentro del presupuesto"}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Ingresos</CardDescription>
                <CardTitle className="text-xl tabular-nums">{formatMoney(ingresos)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">en la semana</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Ahorrado</CardDescription>
                <CardTitle className="text-xl tabular-nums">{formatMoney(aportado)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">aportado a tus metas</CardContent>
            </Card>
          </div>

          {noBudget ? (
            <Link
              href="/ajustes"
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <span>
                Aún no defines tu presupuesto semanal. Ponle un monto a cada categoría para ver
                en cuáles te pasas.
              </span>
              <span className="shrink-0 font-medium">Ir a Ajustes</span>
            </Link>
          ) : null}

          {pendientes > 0 ? (
            <Link
              href="/revisar"
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <span>
                {plural(pendientes, "gasto está", "gastos están")} sin revisar; hasta que tengan
                categoría no cuentan en el presupuesto.
              </span>
              <span className="shrink-0 font-medium">Revisar</span>
            </Link>
          ) : null}

          {categories.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>En qué se va el gasto</CardTitle>
                <CardDescription>Reparto del gasto por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <SpendingPie
                  periods={[
                    {
                      id: "semana",
                      label: isCurrentWeek ? "Esta semana" : "Esa semana",
                      detalle: formatWeek(start),
                      slices: pieSlices(1),
                    },
                    {
                      id: "cuatro",
                      label: "Últimas 4 semanas",
                      detalle: "4 semanas",
                      slices: pieSlices(4),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="categorias">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="categorias" className="text-lg font-semibold tracking-tight">
                  Presupuesto por categoría
                </h2>
                <p className="text-sm text-muted-foreground">Ordenado de mayor a menor exceso.</p>
              </div>
              <Link
                href={query(start, !prorate)}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {prorate
                  ? "Cargos fijos mensuales repartidos por semana · ver cargos reales"
                  : "Viendo cargos reales · repartir los fijos mensuales por semana"}
              </Link>
            </div>

            {summary.categorias.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                Aún no tienes categorías. Créalas en Ajustes con su presupuesto semanal.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {summary.categorias.map((c) => (
                  <CategoryWeekCard
                    key={c.id}
                    category={c}
                    elapsed={summary.elapsed}
                    isCurrentWeek={isCurrentWeek}
                  />
                ))}
              </div>
            )}

            {summary.sinCategoria > 0 ? (
              <p className="text-sm text-muted-foreground">
                Fuera del presupuesto: {formatMoney(summary.sinCategoria)} en gastos sin categoría
                (depósitos, transferencias o pendientes de revisar).
              </p>
            ) : null}
          </section>

          {summary.categorias.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Presupuesto contra gastado</CardTitle>
                  <CardDescription>Semana del {formatWeek(start)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <BudgetBars
                    data={summary.categorias.map((c) => ({
                      nombre: c.nombre,
                      presupuesto: c.presupuesto,
                      gastado: c.gastado,
                      excedido: c.estado === "excedido",
                    }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Evolución semanal</CardTitle>
                  <CardDescription>Gasto total de las últimas {HISTORY_WEEKS} semanas</CardDescription>
                </CardHeader>
                <CardContent>
                  <HistoryBars
                    presupuesto={summary.presupuesto}
                    data={history.map((w) => ({
                      semana: w.start,
                      label: formatShortDay(w.start),
                      gastado: w.gastado,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
