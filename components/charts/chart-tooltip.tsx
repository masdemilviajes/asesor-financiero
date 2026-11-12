"use client";

import { formatMoney } from "@/lib/config";

type Entry = { name?: string | number; value?: unknown; color?: string };

/** Tooltip común: título y una línea por serie con el monto formateado. */
export function ChartTooltip({
  active,
  label,
  payload,
  title,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly Entry[];
  title?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{title ? title(String(label)) : label}</p>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          {formatMoney(Number(entry.value))}
        </p>
      ))}
    </div>
  );
}

export function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}
