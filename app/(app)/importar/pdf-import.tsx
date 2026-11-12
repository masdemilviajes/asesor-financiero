"use client";

import { useState } from "react";
import { FormError } from "@/components/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportRow } from "@/lib/import/parse";
import { createClient } from "@/lib/supabase/client";
import { previewImport, type PreviewRow } from "./actions";
import { FilePicker } from "./file-picker";
import { ImportPreview } from "./import-preview";
import type { ImportContext } from "./import-tabs";

const BUCKET = "estados-de-cuenta";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

type Step = "idle" | "subiendo" | "leyendo" | "revisando";

const STEP_TEXT: Record<Exclude<Step, "idle">, string> = {
  subiendo: "Subiendo el PDF a tu almacenamiento privado…",
  leyendo: "Leyendo el estado de cuenta con IA. Puede tardar uno o dos minutos…",
  revisando: "Revisando duplicados…",
};

/** Importación de un estado de cuenta en PDF: Storage privado + extracción con IA. */
export function PdfImport({ userId, accounts }: ImportContext) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  function resetAll() {
    setStep("idle");
    setError(undefined);
    setFileName("");
    setImportId(null);
    setNote(undefined);
    setPreview(null);
  }

  async function onFile(file: File) {
    resetAll();
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      return setError("Elige un archivo PDF.");
    }
    if (file.size > MAX_PDF_BYTES) return setError("El PDF pesa más de 20 MB.");
    setFileName(file.name);

    try {
      setStep("subiendo");
      const path = `${userId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await createClient()
        .storage.from(BUCKET)
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(`No pude subir el PDF: ${uploadError.message}`);

      setStep("leyendo");
      const response = await fetch("/api/import/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruta_storage: path, nombre_archivo: file.name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No pude leer el estado de cuenta.");

      const rows = data.rows as ImportRow[];
      if (rows.length === 0) {
        throw new Error("No encontré movimientos en este PDF. ¿Es un estado de cuenta?");
      }

      setStep("revisando");
      const result = await previewImport(rows);
      if (!result.ok) throw new Error(result.error);

      setImportId(data.import_id);
      setNote(data.ultimos4 ? `Cuenta terminada en ${data.ultimos4}.` : undefined);
      setPreview(result.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setStep("idle");
    }
  }

  if (preview) {
    return (
      <ImportPreview
        rows={preview}
        accounts={accounts}
        fileName={fileName}
        importId={importId}
        note={note}
        onReset={resetAll}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de cuenta en PDF</CardTitle>
        <CardDescription>
          El PDF se guarda en tu almacenamiento privado y la IA extrae los movimientos. Antes de
          guardar verás una vista previa. De los números de tarjeta o cuenta solo se conservan los
          últimos 4 dígitos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FilePicker
          accept="application/pdf,.pdf"
          label="Elegir estado de cuenta en PDF"
          disabled={step !== "idle"}
          onFile={onFile}
        />
        {step !== "idle" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {STEP_TEXT[step]}
          </p>
        ) : null}
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}
