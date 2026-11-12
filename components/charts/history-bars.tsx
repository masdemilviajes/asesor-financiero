"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART } from "@/lib/chart-colors";
import { ChartTooltip, LegendItem } from "./chart-tooltip";

export type HistoryRow = { label: string; semana: string; gastado: number };

const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });

/** Gasto total por semana contra el presupuesto semanal (línea punteada). */
export function HistoryBars({ data, presupuesto }: { data: HistoryRow[]; presupuesto: number }) {
  const anyExceeded = presupuesto > 0 && data.some((d) => d.gastado > presupuesto);

  return (
    <figure className="flex flex-col gap-3">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={16}
              tick={{ fill: CHART.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={44}
              tickFormatter={(v: number) => `$${compact.format(v)}`}
              tick={{ fill: CHART.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={<ChartTooltip title={(label) => `Semana del ${label}`} />}
            />
            <Bar
              dataKey="gastado"
              name="Gastado"
              fill={CHART.ink}
              maxBarSize={18}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell
                  key={row.semana}
                  fill={presupuesto > 0 && row.gastado > presupuesto ? CHART.red : CHART.ink}
                />
              ))}
            </Bar>
            {presupuesto > 0 ? (
              <ReferenceLine
                y={presupuesto}
                stroke={CHART.text}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendItem color={CHART.ink} label="Gastado" />
        {anyExceeded ? <LegendItem color={CHART.red} label="Gastado (excedido)" /> : null}
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.text }} aria-hidden />
          Presupuesto semanal
        </span>
      </figcaption>
    </figure>
  );
}
