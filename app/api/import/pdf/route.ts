import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, askJson } from "@/lib/anthropic";
import { CURRENCY, todayInTimezone } from "@/lib/config";
import { maskSensitive, parseDate, type ImportRow } from "@/lib/import/parse";
import { STATEMENTS_BUCKET } from "@/lib/import/server";
import { createClient } from "@/lib/supabase/server";

// Leer un estado de cuenta largo puede tardar más de un minuto.
export const maxDuration = 300;

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const bodySchema = z.object({
  ruta_storage: z.string().min(1).max(500),
  nombre_archivo: z.string().trim().min(1).max(200),
});

const statementSchema = z.object({
  movimientos: z.array(
    z.object({
      fecha: z.string(),
      descripcion: z.string(),
      monto: z.number(),
      tipo: z.enum(["gasto", "ingreso", "transferencia"]),
    }),
  ),
  ultimos4_cuenta: z.string().nullable(),
});

const SYSTEM = `Extraes los movimientos de un estado de cuenta bancario o de tarjeta en PDF.

- Devuelve cada movimiento (compra, cargo, retiro, comisión, interés, pago, depósito, abono, transferencia) una sola vez, en el orden en que aparece.
- "fecha": YYYY-MM-DD. Si el documento omite el año, dedúcelo del periodo del estado de cuenta.
- "descripcion": el texto del movimiento tal como aparece, sin la fecha ni el monto.
- "monto": número positivo, sin símbolos ni separadores de miles.
- "tipo": "gasto" para dinero que sale o cargos a la tarjeta; "ingreso" para dinero que entra (depósitos, sueldo, reembolsos); "transferencia" cuando el dinero solo cambia de sitio y sigue siendo del titular: traspasos entre sus propias cuentas (ahorro, inversión, otra cuenta a su nombre), pagos a su propia tarjeta de crédito (tanto en la cuenta desde la que se paga como en la tarjeta que lo recibe) y conversiones de moneda. Una transferencia o pago a otra persona o empresa es "gasto". Si no está claro que sea entre cuentas propias, usa "gasto" o "ingreso".
- No incluyas saldos iniciales o finales, totales, subtotales, límites de crédito, pagos mínimos ni resúmenes.
- "ultimos4_cuenta": los últimos 4 dígitos de la cuenta o tarjeta si aparecen; si no, null. Nunca el número completo.
- Si el documento no es un estado de cuenta o no tiene movimientos, devuelve una lista vacía.`;

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Falta el archivo a procesar." }, { status: 400 });
  }
  const { ruta_storage, nombre_archivo } = body.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Cada usuario solo puede procesar archivos de su propia carpeta.
  if (!ruta_storage.startsWith(`${user.id}/`) || ruta_storage.includes("..")) {
    return NextResponse.json({ error: "Archivo no permitido." }, { status: 403 });
  }

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({ nombre_archivo, ruta_storage, estado: "procesando" })
    .select("id")
    .single();
  if (importError) {
    return NextResponse.json({ error: "No se pudo registrar la importación." }, { status: 500 });
  }
  const importId: string = importRow.id;

  const fail = async (message: string, status: number) => {
    await supabase.from("imports").update({ estado: "error" }).eq("id", importId);
    return NextResponse.json({ error: message }, { status });
  };

  const { data: file, error: downloadError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .download(ruta_storage);
  if (downloadError || !file) return fail("No pude leer el PDF guardado.", 500);
  if (file.size > MAX_PDF_BYTES) return fail("El PDF pesa más de 20 MB.", 413);

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const today = todayInTimezone();

  try {
    const result = await askJson({
      schema: statementSchema,
      system: SYSTEM,
      effort: "medium",
      maxTokens: 64000,
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
        },
        {
          type: "text",
          text: `Extrae todos los movimientos de este estado de cuenta. Hoy es ${today}. Moneda: ${CURRENCY}.`,
        },
      ],
    });

    const rows: ImportRow[] = [];
    for (const m of result.movimientos) {
      const fecha = parseDate(m.fecha);
      const descripcion = maskSensitive(m.descripcion.trim());
      if (!fecha || !descripcion || !(m.monto > 0)) continue;
      rows.push({ fecha, descripcion, monto: Math.round(m.monto * 100) / 100, tipo: m.tipo });
    }

    await supabase
      .from("imports")
      .update({ estado: "listo", movimientos_detectados: rows.length })
      .eq("id", importId);

    const ultimos4 = result.ultimos4_cuenta?.replace(/\D/g, "").slice(-4) ?? "";
    return NextResponse.json({
      import_id: importId,
      rows,
      ultimos4: ultimos4.length === 4 ? ultimos4 : null,
    });
  } catch (error) {
    return fail(error instanceof AiError ? error.message : "No pude leer el estado de cuenta.", 502);
  }
}
