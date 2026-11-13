"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART } from "@/lib/chart-colors";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export type PieSlice = { id: string; nombre: string; total: number; color: string };
export type PiePeriod = { id: string; label: string; detalle: string; slices: PieSlice[] };

function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: readonly { payload?: PieSlice }[];
  total: number;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <span className="size-2 rounded-sm" style={{ backgroundColor: slice.color }} />
        {slice.nombre}
      </p>
      <p className="tabular-nums text-muted-foreground">
        {formatMoney(slice.total)} · {Math.round((slice.total / total) * 100)}%
      </p>
    </div>
  );
}

/**
 * Gráfico de sectores: cuánto se gasta en cada categoría.
 * Cada categoría conserva siempre su color; la lista de abajo da los montos.
 */
export function SpendingPie({ periods }: { periods: PiePeriod[] }) {
  const [periodId, setPeriodId] = useState(periods[0]?.id);
  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  if (!period) return null;

  const slices = period.slices.filter((s) => s.total > 0);
  const total = slices.reduce((sum, s) => sum + s.total, 0);
  const ranked = [...slices].sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-4">
      {periods.length > 1 ? (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Periodo">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === period.id}
              onClick={() => setPeriodId(p.id)}
              className={cn(
                "h-9 rounded-md text-sm font-medium text-muted-foreground transition-colors",
                p.id === period.id && "bg-background text-foreground shadow-sm",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {total <= 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay gastos con categoría en este periodo.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <figure className="relative mx-auto size-56 shrink-0" aria-label="Gasto por categoría">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="nombre"
                  innerRadius="58%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={slices.length > 1 ? 1 : 0}
                  stroke={CHART.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.id} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-muted-foreground">{period.detalle}</span>
              <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
            </figcaption>
          </figure>

          <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm" data-testid="pie-leyenda">
            {ranked.map((slice) => (
              <li key={slice.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate">{slice.nombre}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(slice.total)}</span>
                <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                  {Math.round((slice.total / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
