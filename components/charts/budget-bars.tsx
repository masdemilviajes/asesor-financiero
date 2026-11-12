"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "@/lib/chart-colors";
import { ChartTooltip, LegendItem } from "./chart-tooltip";

export type BudgetBarRow = {
  nombre: string;
  presupuesto: number;
  gastado: number;
  excedido: boolean;
};

const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });

/** Barras horizontales: presupuesto semanal contra lo gastado, por categoría. */
export function BudgetBars({ data }: { data: BudgetBarRow[] }) {
  const anyExceeded = data.some((d) => d.excedido);

  return (
    <figure className="flex flex-col gap-3">
      <div style={{ height: data.length * 44 + 32 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            barGap={2}
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => `$${compact.format(v)}`}
              tick={{ fill: CHART.text, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="nombre"
              width={108}
              tick={{ fill: CHART.text, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<ChartTooltip />} />
            <Bar
              dataKey="presupuesto"
              name="Presupuesto"
              fill={CHART.muted}
              barSize={8}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="gastado"
              name="Gastado"
              fill={CHART.ink}
              barSize={8}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell key={row.nombre} fill={row.excedido ? CHART.red : CHART.ink} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendItem color={CHART.muted} label="Presupuesto" />
        <LegendItem color={CHART.ink} label="Gastado" />
        {anyExceeded ? <LegendItem color={CHART.red} label="Gastado (excedido)" /> : null}
      </figcaption>
    </figure>
  );
}
