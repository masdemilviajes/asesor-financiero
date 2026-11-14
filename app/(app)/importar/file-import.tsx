"use client";

import { useMemo, useState } from "react";
import { Field, FormError, TOUCH_SELECT } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMoney } from "@/lib/config";
import { formatDay, plural } from "@/lib/format";
import {
  buildTransactions,
  cleanRows,
  detectColumns,
  singleSign,
  type Cell,
  type ColumnMapping,
  type DateOrder,
  type SignRule,
} from "@/lib/import/parse";
import { previewImport, type PreviewRow } from "./actions";
import { FilePicker } from "./file-picker";
import { ImportPreview } from "./import-preview";
import type { ImportContext } from "./import-tabs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function readRows(file: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Cell[][];
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error("El formato .xls antiguo no está soportado. Guárdalo como .xlsx o .csv.");
  }
  const Papa = (await import("papaparse")).default;
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
}

function columnLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/** Importación de CSV o Excel: detecta columnas y deja confirmar el mapeo. */
export function FileImport({ accounts }: ImportContext) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [split, setSplit] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  function resetAll() {
    setFileName("");
    setRows(null);
    setMapping(null);
    setPreview(null);
    setError(undefined);
  }

  async function onFile(file: File) {
    resetAll();
    if (file.size > MAX_FILE_BYTES) return setError("El archivo pesa más de 10 MB.");
    setLoading(true);
    try {
      const data = cleanRows(await readRows(file));
      if (data.length === 0) throw new Error("El archivo está vacío.");
      const detected = detectColumns(data);
      setFileName(file.name);
      setRows(data);
      setMapping(detected);
      setSplit(detected.cargo !== null || detected.abono !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude leer el archivo.");
    } finally {
      setLoading(false);
    }
  }

  // Con "cargo y abono" se ignora la columna de monto, y viceversa.
  const effective = useMemo<ColumnMapping | null>(() => {
    if (!mapping) return null;
    return split ? { ...mapping, monto: null } : { ...mapping, cargo: null, abono: null };
  }, [mapping, split]);

  const built = useMemo(
    () => (rows && effective ? buildTransactions(rows, effective) : null),
    [rows, effective],
  );

  const columns = useMemo(() => {
    if (!rows || !mapping) return [];
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const header = mapping.hasHeader ? rows[0] : null;
    const sample = rows[mapping.hasHeader ? 1 : 0] ?? [];
    return Array.from({ length: width }, (_, i) => {
      const title = header ? String(header[i] ?? "").trim() : "";
      const example = String(sample[i] instanceof Date ? "fecha" : (sample[i] ?? "")).slice(0, 24);
      return { index: i, label: `${columnLetter(i)} · ${title || example || "vacía"}` };
    });
  }, [rows, mapping]);

  const update = (patch: Partial<ColumnMapping>) =>
    setMapping((prev) => (prev ? { ...prev, ...patch } : prev));

  const columnSelect = (
    id: string,
    label: string,
    key: "fecha" | "descripcion" | "monto" | "cargo" | "abono",
  ) => (
    <Field label={label} htmlFor={id}>
      <NativeSelect
        id={id}
        value={mapping?.[key] ?? ""}
        onChange={(e) => update({ [key]: e.target.value === "" ? null : Number(e.target.value) })}
        className={TOUCH_SELECT}
      >
        <NativeSelectOption value="">No usar</NativeSelectOption>
        {columns.map((c) => (
          <NativeSelectOption key={c.index} value={c.index}>
            {c.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  async function goToPreview() {
    if (!built || built.rows.length === 0) return;
    setLoading(true);
    setError(undefined);
    const result = await previewImport(built.rows);
    setLoading(false);
    if (result.ok) setPreview(result.rows);
    else setError(result.error);
  }

  if (preview) {
    return (
      <ImportPreview
        rows={preview}
        accounts={accounts}
        fileName={fileName}
        note={
          built && built.skipped > 0
            ? built.skipped === 1
              ? "1 fila no se pudo leer."
              : `${built.skipped} filas no se pudieron leer.`
            : undefined
        }
        onReset={resetAll}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV o Excel</CardTitle>
        <CardDescription>
          Descarga tus movimientos desde la web de tu banco en formato CSV o Excel (.xlsx) y sube
          el archivo aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FilePicker
          accept=".csv,.xlsx,.txt,text/csv"
          label={fileName ? `Cambiar archivo (${fileName})` : "Elegir archivo CSV o Excel"}
          disabled={loading}
          onFile={onFile}
        />
        <FormError message={error} />

        {mapping && built ? (
          <div className="flex flex-col gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Detecté estas columnas. Corrígelas si alguna no coincide.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {columnSelect("map-fecha", "Fecha", "fecha")}
              {columnSelect("map-descripcion", "Descripción", "descripcion")}
              {split ? (
                <>
                  {columnSelect("map-cargo", "Cargos (dinero que sale)", "cargo")}
                  {columnSelect("map-abono", "Abonos (dinero que entra)", "abono")}
                </>
              ) : (
                <>
                  {columnSelect("map-monto", "Monto", "monto")}
                  <Field
                    label="Signo del monto"
                    htmlFor="map-signo"
                    hint={
                      rows && singleSign(rows, mapping)
                        ? mapping.signo === "positivo_gasto"
                          ? "Todos los montos tienen el mismo signo y los estoy leyendo como gastos. Si son depósitos, cámbialo."
                          : "Todos los montos tienen el mismo signo y los estoy leyendo como ingresos. Si son compras, cámbialo."
                        : undefined
                    }
                  >
                    <NativeSelect
                      id="map-signo"
                      value={mapping.signo}
                      onChange={(e) => update({ signo: e.target.value as SignRule })}
                      className={TOUCH_SELECT}
                    >
                      <NativeSelectOption value="negativo_gasto">
                        Los negativos son gastos
                      </NativeSelectOption>
                      <NativeSelectOption value="positivo_gasto">
                        Los positivos son gastos
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </>
              )}
              <Field label="Formato de fecha" htmlFor="map-orden">
                <NativeSelect
                  id="map-orden"
                  value={mapping.dateOrder}
                  onChange={(e) => update({ dateOrder: e.target.value as DateOrder })}
                  className={TOUCH_SELECT}
                >
                  <NativeSelectOption value="dmy">Día / mes / año</NativeSelectOption>
                  <NativeSelectOption value="mdy">Mes / día / año</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <label className="flex min-h-9 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-foreground"
                  checked={mapping.hasHeader}
                  onChange={(e) => update({ hasHeader: e.target.checked })}
                />
                La primera fila son títulos de columna
              </label>
              <label className="flex min-h-9 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-foreground"
                  checked={split}
                  onChange={(e) => setSplit(e.target.checked)}
                />
                Cargos y abonos vienen en columnas separadas
              </label>
            </div>

            <div className="rounded-lg border">
              <p className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                Así se leerían los primeros movimientos
              </p>
              {built.rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Con este mapeo no se puede leer ningún movimiento. Revisa las columnas de fecha,
                  descripción y monto.
                </p>
              ) : (
                <ul className="divide-y">
                  {built.rows.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{r.descripcion}</span>
                        <span className="block text-xs text-muted-foreground first-letter:uppercase">
                          {formatDay(r.fecha)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {r.tipo === "ingreso" ? "+" : "−"}
                        {formatMoney(r.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {plural(built.rows.length, "movimiento legible", "movimientos legibles")}
              {built.skipped > 0
                ? ` · ${plural(built.skipped, "fila omitida", "filas omitidas")} (sin fecha o sin monto)`
                : ""}
            </p>

            <Button
              size="lg"
              className="h-12 text-base"
              disabled={loading || built.rows.length === 0}
              onClick={goToPreview}
            >
              {loading ? "Revisando duplicados…" : "Continuar a la vista previa"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
