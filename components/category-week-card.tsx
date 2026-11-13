import { TrendingUp, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryWeek } from "@/lib/budget";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

function StatusBadge({ estado }: { estado: CategoryWeek["estado"] }) {
  if (estado === "excedido") {
    // Único uso del rojo en toda la app.
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-medium text-white">
        <TriangleAlert className="size-3" aria-hidden /> Excedido
      </span>
    );
  }
  if (estado === "en_riesgo") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border border-foreground px-2.5 py-0.5 text-xs font-medium">
        <TrendingUp className="size-3" aria-hidden /> En riesgo
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
      {estado === "ok" ? "En orden" : "Sin presupuesto"}
    </span>
  );
}

function paceText(c: CategoryWeek, isCurrentWeek: boolean): string {
  if (c.ritmo === null) return "Define su presupuesto semanal en Ajustes para medir el ritmo.";
  if (!isCurrentWeek) return "Semana cerrada.";
  const points = Math.round(Math.abs(c.ritmo));
  if (points < 1) return "Vas justo al ritmo de la semana.";
  return c.ritmo > 0
    ? `Vas ${points} puntos por encima del avance de la semana.`
    : `Vas ${points} puntos por debajo del avance de la semana.`;
}

/** Tarjeta de una categoría: gastado, presupuesto, diferencia, ritmo y proyección. */
export function CategoryWeekCard({
  category: c,
  elapsed,
  isCurrentWeek,
}: {
  category: CategoryWeek;
  elapsed: number;
  isCurrentWeek: boolean;
}) {
  const exceeded = c.estado === "excedido";
  const fill = c.porcentaje === null ? 0 : Math.min(c.porcentaje, 100);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex min-w-0 items-center gap-2 font-medium">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: c.color }}
            />
            <span className="truncate">{c.nombre}</span>
          </h3>
          <StatusBadge estado={c.estado} />
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <p className="tabular-nums">
            <span className="text-lg font-semibold">{formatMoney(c.gastado)}</span>
            {c.porcentaje !== null ? (
              <span className="text-sm text-muted-foreground"> de {formatMoney(c.presupuesto)}</span>
            ) : null}
          </p>
          <p className={cn("text-sm tabular-nums", exceeded ? "font-medium" : "text-muted-foreground")}>
            {c.porcentaje === null
              ? "sin presupuesto"
              : c.diferencia > 0
                ? `${formatMoney(c.diferencia)} de más · ${Math.round(c.porcentaje)}%`
                : `${formatMoney(Math.abs(c.diferencia))} disponibles · ${Math.round(c.porcentaje)}%`}
          </p>
        </div>

        <div
          className="relative h-2 rounded-full bg-muted"
          role="img"
          aria-label={
            c.porcentaje !== null
              ? `${Math.round(c.porcentaje)}% del presupuesto gastado; ${Math.round(elapsed * 100)}% de la semana transcurrida`
              : "Sin presupuesto"
          }
        >
          <div
            className={cn("h-full rounded-full", exceeded ? "bg-destructive" : "bg-foreground")}
            style={{ width: `${fill}%` }}
          />
          {isCurrentWeek && c.porcentaje !== null ? (
            <div
              className="absolute -top-1 h-4 w-0.5 rounded-full bg-background ring-1 ring-foreground/60"
              style={{ left: `calc(${elapsed * 100}% - 1px)` }}
              title="Avance de la semana"
            />
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {paceText(c, isCurrentWeek)}
          {isCurrentWeek && c.gastado > 0 && c.ritmo !== null
            ? ` Proyección al domingo: ${formatMoney(c.proyeccion)}.`
            : ""}
        </p>

        {c.top.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t pt-2 text-xs">
            {c.top.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">
                  {item.label}
                  {item.fixed ? " (fijo, parte de la semana)" : ""}
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
