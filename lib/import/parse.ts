// Lectura de CSV/Excel: detección de columnas, fechas y montos.
// Funciones puras (sin red ni base de datos) para poder probarlas.

import { parseAmount } from "@/lib/format";
import type { TransactionType } from "@/lib/types";

/** Un movimiento listo para la vista previa de importación. */
export type ImportRow = {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  monto: number; // siempre positivo
  tipo: TransactionType;
};

export type Cell = string | number | boolean | Date | null | undefined;
export type DateOrder = "dmy" | "mdy";
export type SignRule = "negativo_gasto" | "positivo_gasto";

export type ColumnMapping = {
  hasHeader: boolean;
  fecha: number | null;
  descripcion: number | null;
  /** Una sola columna de monto con signo… */
  monto: number | null;
  /** …o dos columnas separadas de cargos y abonos. */
  cargo: number | null;
  abono: number | null;
  dateOrder: DateOrder;
  signo: SignRule;
};

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // p. ej. 31 de febrero
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Convierte una celda en fecha YYYY-MM-DD, o null si no parece una fecha. */
export function parseDate(value: Cell, order: DateOrder = "dmy"): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:\D|$)/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    return order === "dmy" ? iso(y, b, a) : iso(y, a, b);
  }

  m = s.match(/^(\d{1,2})[-/\s]+([A-Za-zÀ-ÿ]{3,})\.?[-/\s,]+(\d{4}|\d{2})(?:\D|$)/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return month ? iso(+m[3], month, +m[1]) : null;
  }

  m = s.match(/^([A-Za-zÀ-ÿ]{3,})\.?\s+(\d{1,2}),?\s+(\d{4}|\d{2})(?:\D|$)/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return month ? iso(+m[3], month, +m[2]) : null;
  }

  return null;
}

/** Decide si las fechas numéricas vienen como día/mes o mes/día. */
export function detectDateOrder(values: Cell[]): DateOrder {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const v of values) {
    if (typeof v !== "string") continue;
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dayFirst++;
    else if (+m[2] > 12) monthFirst++;
  }
  // En caso de duda, día/mes (lo habitual en Australia y Latinoamérica).
  return monthFirst > dayFirst ? "mdy" : "dmy";
}

/** Monto de una celda. Acepta "$1,234.50", "-12.5", "(12.50)" y "12.50-". */
export function parseCellAmount(value: Cell): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const s = value.trim();
  if (!s || /[A-Za-z]{4,}/.test(s)) return NaN;
  const negative = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /\bDR\b/i.test(s);
  const n = parseAmount(s.replace(/[()]/g, "").replace(/-\s*$/, ""));
  if (Number.isNaN(n)) return NaN;
  return negative ? -Math.abs(n) : n;
}

function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const HEADER_PATTERNS = {
  fecha: /fecha|date/,
  descripcion: /descrip|concepto|detalle|narrat|memo|details|particular|payee|merchant|comercio|transaction|movimiento|referencia/,
  cargo: /cargo|debit|retiro|withdraw|paid out|egreso|money out/,
  abono: /abono|credit|deposit|paid in|ingreso|money in/,
  monto: /monto|importe|amount|valor|total/,
  saldo: /saldo|balance/,
};

function isEmpty(cell: Cell): boolean {
  return cell == null || String(cell).trim() === "";
}

/** Quita filas totalmente vacías. */
export function cleanRows(rows: Cell[][]): Cell[][] {
  return rows.filter((row) => row.some((cell) => !isEmpty(cell)));
}

/** Detecta qué columna es la fecha, la descripción y el monto. */
export function detectColumns(allRows: Cell[][]): ColumnMapping {
  const rows = cleanRows(allRows);
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const first = rows[0] ?? [];

  // Hay encabezado si la primera fila no trae ni fechas ni números.
  const hasHeader =
    rows.length > 1 &&
    first.every((c) => isEmpty(c) || (parseDate(c) === null && Number.isNaN(parseCellAmount(c))));

  const data = rows.slice(hasHeader ? 1 : 0, 60);
  const dateOrder = detectDateOrder(data.flat());

  const mapping: ColumnMapping = {
    hasHeader,
    fecha: null,
    descripcion: null,
    monto: null,
    cargo: null,
    abono: null,
    dateOrder,
    signo: "negativo_gasto",
  };

  const excluded = new Set<number>();
  if (hasHeader) {
    first.forEach((cell, i) => {
      const h = normalizeHeader(cell);
      if (!h) return;
      if (HEADER_PATTERNS.saldo.test(h)) excluded.add(i);
      else if (mapping.fecha === null && HEADER_PATTERNS.fecha.test(h)) mapping.fecha = i;
      else if (mapping.cargo === null && HEADER_PATTERNS.cargo.test(h)) mapping.cargo = i;
      else if (mapping.abono === null && HEADER_PATTERNS.abono.test(h)) mapping.abono = i;
      else if (mapping.monto === null && HEADER_PATTERNS.monto.test(h)) mapping.monto = i;
      else if (mapping.descripcion === null && HEADER_PATTERNS.descripcion.test(h))
        mapping.descripcion = i;
    });
  }

  // Lo que no se resolvió por nombre se deduce del contenido.
  const stats = Array.from({ length: width }, (_, i) => {
    const cells = data.map((r) => r[i]).filter((c) => !isEmpty(c));
    const total = Math.max(cells.length, 1);
    const amounts = cells.map(parseCellAmount).filter((n) => !Number.isNaN(n));
    return {
      filled: cells.length,
      dates: cells.filter((c) => parseDate(c, dateOrder) !== null).length / total,
      numbers: amounts.length / total,
      negatives: amounts.filter((n) => n < 0).length,
      textLength:
        cells.filter((c) => typeof c === "string").reduce((s, c) => s + String(c).length, 0) /
        total,
    };
  });

  const used = () =>
    new Set(
      [mapping.fecha, mapping.descripcion, mapping.monto, mapping.cargo, mapping.abono].filter(
        (i): i is number => i !== null,
      ),
    );
  const free = (i: number) => !used().has(i) && !excluded.has(i) && stats[i].filled > 0;

  if (mapping.fecha === null) {
    const i = stats.findIndex((s, idx) => free(idx) && s.dates >= 0.6);
    if (i >= 0) mapping.fecha = i;
  }

  if (mapping.monto === null && mapping.cargo === null && mapping.abono === null) {
    const numeric = stats
      .map((s, i) => ({ ...s, i }))
      .filter((s) => free(s.i) && s.numbers >= 0.6 && s.dates < 0.6);
    // Si hay varias columnas numéricas (monto y saldo), gana la que trae negativos.
    const pick = numeric.find((s) => s.negatives > 0) ?? numeric[0];
    if (pick) mapping.monto = pick.i;
  }

  if (mapping.descripcion === null) {
    const texts = stats
      .map((s, i) => ({ ...s, i }))
      .filter((s) => free(s.i) && s.numbers < 0.6 && s.dates < 0.6)
      .sort((a, b) => b.textLength - a.textLength);
    if (texts[0]) mapping.descripcion = texts[0].i;
  }

  if (mapping.monto !== null) {
    mapping.signo = stats[mapping.monto]?.negatives > 0 ? "negativo_gasto" : "positivo_gasto";
  }

  return mapping;
}

export type BuildResult = { rows: ImportRow[]; skipped: number };

/** Aplica el mapeo y devuelve los movimientos; cuenta las filas que no se pudieron leer. */
export function buildTransactions(allRows: Cell[][], mapping: ColumnMapping): BuildResult {
  const rows = cleanRows(allRows).slice(mapping.hasHeader ? 1 : 0);
  const out: ImportRow[] = [];
  let skipped = 0;

  for (const row of rows) {
    const fecha = mapping.fecha !== null ? parseDate(row[mapping.fecha], mapping.dateOrder) : null;
    const descripcion =
      mapping.descripcion !== null ? String(row[mapping.descripcion] ?? "").trim() : "";

    let monto = NaN;
    let tipo: TransactionType = "gasto";

    if (mapping.cargo !== null || mapping.abono !== null) {
      const cargo = mapping.cargo !== null ? parseCellAmount(row[mapping.cargo]) : NaN;
      const abono = mapping.abono !== null ? parseCellAmount(row[mapping.abono]) : NaN;
      if (!Number.isNaN(cargo) && cargo !== 0) {
        monto = Math.abs(cargo);
        tipo = "gasto";
      } else if (!Number.isNaN(abono) && abono !== 0) {
        monto = Math.abs(abono);
        tipo = "ingreso";
      }
    } else if (mapping.monto !== null) {
      const value = parseCellAmount(row[mapping.monto]);
      if (!Number.isNaN(value) && value !== 0) {
        monto = Math.abs(value);
        const isExpense = mapping.signo === "negativo_gasto" ? value < 0 : value > 0;
        tipo = isExpense ? "gasto" : "ingreso";
      }
    }

    if (!fecha || !descripcion || Number.isNaN(monto)) {
      skipped++;
      continue;
    }
    out.push({ fecha, descripcion, monto: Math.round(monto * 100) / 100, tipo });
  }

  return { rows: out, skipped };
}

/**
 * Oculta números largos (tarjetas, cuentas): deja solo los últimos 4 dígitos.
 * Se aplica a toda descripción importada antes de guardarla.
 */
export function maskSensitive(text: string): string {
  return text.replace(/\b\d(?:[ -]?\d){11,18}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return `••••${digits.slice(-4)}`;
  });
}
