"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field, FormError, TOUCH_SELECT } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMoney } from "@/lib/config";
import { formatDay, plural } from "@/lib/format";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";
import { confirmImport, type ConfirmResult, type PreviewRow } from "./actions";

/** Vista previa común a CSV, Excel y PDF: se revisa y se confirma antes de guardar. */
export function ImportPreview({
  rows,
  accounts,
  fileName,
  importId,
  suggestedAccountId,
  note,
  onReset,
}: {
  rows: PreviewRow[];
  accounts: Pick<Account, "id" | "nombre">[];
  fileName: string;
  importId?: string | null;
  suggestedAccountId?: string | null;
  note?: string;
  onReset: () => void;
}) {
  const [selected, setSelected] = useState<boolean[]>(() => rows.map((r) => !r.duplicado));
  const [accountId, setAccountId] = useState(suggestedAccountId ?? "");
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();

  const duplicates = rows.filter((r) => r.duplicado).length;
  const chosen = useMemo(() => rows.filter((_, i) => selected[i]), [rows, selected]);
  const totals = useMemo(
    () => ({
      gastos: chosen.filter((r) => r.tipo === "gasto").reduce((s, r) => s + r.monto, 0),
      ingresos: chosen.filter((r) => r.tipo === "ingreso").reduce((s, r) => s + r.monto, 0),
    }),
    [chosen],
  );

  function save() {
    startTransition(async () => {
      setResult(
        await confirmImport({
          rows: chosen.map(({ fecha, descripcion, monto, tipo }) => ({ fecha, descripcion, monto, tipo })),
          account_id: accountId,
          nombre_archivo: fileName,
          import_id: importId ?? null,
        }),
      );
    });
  }

  if (result?.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-5" aria-hidden /> Importación terminada
          </CardTitle>
          <CardDescription role="status">
            {result.guardados === 1
              ? "Se guardó 1 movimiento."
              : `Se guardaron ${result.guardados} movimientos.`}
            {result.duplicados > 0
              ? result.duplicados === 1
                ? " 1 ya existía y se descartó."
                : ` ${result.duplicados} ya existían y se descartaron.`
              : ""}
            {result.recurrentes > 0
              ? result.recurrentes === 1
                ? " 1 quedó marcado como recurrente."
                : ` ${result.recurrentes} quedaron marcados como recurrentes.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Link href="/movimientos" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
            Ver movimientos
          </Link>
          <Button variant="outline" size="lg" className="h-11 px-5" onClick={onReset}>
            Importar otro archivo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Vista previa</CardTitle>
        <CardDescription>
          {plural(rows.length, "movimiento", "movimientos")} en «{fileName}».
          {duplicates > 0
            ? duplicates === 1
              ? " 1 ya está registrado y no se guardará."
              : ` ${duplicates} ya están registrados y no se guardarán.`
            : ""}
          {note ? ` ${note}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="px-4">
          <Field label="Cuenta de estos movimientos" htmlFor="import-cuenta">
            <NativeSelect
              id="import-cuenta"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={TOUCH_SELECT}
            >
              <NativeSelectOption value="">Sin cuenta</NativeSelectOption>
              {accounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.nombre}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <ul className="max-h-[50vh] divide-y overflow-y-auto border-y">
          {rows.map((row, i) => (
            <li key={i}>
              <label
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2",
                  row.duplicado && "cursor-default opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-foreground"
                  checked={selected[i]}
                  disabled={row.duplicado}
                  onChange={(e) =>
                    setSelected((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.descripcion}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="first-letter:uppercase">{formatDay(row.fecha)}</span>
                    {row.duplicado ? <Badge variant="outline">Ya registrado</Badge> : null}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {row.tipo === "ingreso" ? "+" : "−"}
                  {formatMoney(row.monto)}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            Seleccionados: {chosen.length} · Gastos {formatMoney(totals.gastos)} · Ingresos{" "}
            {formatMoney(totals.ingresos)}
          </p>
          <FormError message={result && !result.ok ? result.error : undefined} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              size="lg"
              className="h-12 px-5 text-base"
              disabled={pending || chosen.length === 0}
              onClick={save}
            >
              {pending ? "Guardando…" : `Guardar ${plural(chosen.length, "movimiento", "movimientos")}`}
            </Button>
            <Button variant="ghost" size="lg" className="h-12 px-5" disabled={pending} onClick={onReset}>
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
