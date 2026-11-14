// Transferencias entre cuentas propias y conversiones de moneda.
// No son gasto ni ingreso. Funciones puras para poder probarlas.

import { daysBetween } from "@/lib/dates";

/**
 * Palabras que delatan un traspaso entre cuentas propias o una conversión de
 * moneda. Es una lista prudente a propósito: una transferencia a otra persona
 * ("TRANSFER TO J SMITH") sí es un gasto y no debe coincidir.
 */
const TRANSFER_PATTERNS: RegExp[] = [
  /\binternal transfer\b/,
  /\btransfer (to|from) (my |own |your )?(savings?|saver|everyday|offset|goal|checking|cheque|credit card)\b/,
  /\b(to|from) (netbank saver|goal saver|smart access|own account)\b/,
  /\bbetween (my |own )?accounts\b/,
  /\b(traspaso|transferencia) (a|de|entre) (mi |mis )?(cuentas? propias?|ahorros?|inversion)\b/,
  /\bentre cuentas propias\b/,
  /\bcuenta propia\b/,
  /\b(currency|fx|foreign) (conversion|exchange)\b/,
  /\bconvert(ed|ir|iste|i)? \d/,
  /\bconver(sion|ted) (de|from|to|a) [a-z]{3}\b/,
  /\bcambio de (divisa|moneda)s?\b/,
  /\bconversion de (divisa|moneda)s?\b/,
  /\b(credit card|tarjeta( de credito)?) (payment|repayment)\b/,
  /\bpago (de |a )?(la |mi )?tarjeta\b/,
  /\bpayment (received )?-? ?thank you\b/,
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿La descripción parece un traspaso propio o una conversión de moneda? */
export function looksLikeTransfer(description: string): boolean {
  const text = normalize(description);
  return TRANSFER_PATTERNS.some((pattern) => pattern.test(text));
}

export type PairCandidate = {
  id: string;
  fecha: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  account_id: string | null;
  /** Solo se empareja si al menos uno de los dos lados es "nuevo" (recién importado). */
  nuevo: boolean;
};

/** Días de margen entre la salida de una cuenta y la entrada en la otra. */
export const PAIR_DAYS = 3;

/**
 * Empareja una salida de una cuenta con una entrada del mismo monto en OTRA
 * cuenta, con pocos días de diferencia: es dinero que solo cambió de sitio.
 * Devuelve los ids de ambos lados.
 */
export function pairTransfers(rows: PairCandidate[]): string[] {
  const outs = rows.filter((r) => r.tipo === "gasto" && r.account_id);
  const ins = rows.filter((r) => r.tipo === "ingreso" && r.account_id);
  const used = new Set<string>();
  const ids: string[] = [];

  for (const out of [...outs].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    let best: PairCandidate | null = null;
    let bestGap = Infinity;
    for (const candidate of ins) {
      if (used.has(candidate.id)) continue;
      if (candidate.account_id === out.account_id) continue;
      if (!out.nuevo && !candidate.nuevo) continue;
      if (Math.abs(Number(candidate.monto) - Number(out.monto)) > 0.005) continue;
      const gap = Math.abs(daysBetween(out.fecha, candidate.fecha));
      if (gap <= PAIR_DAYS && gap < bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(best.id);
      ids.push(out.id, best.id);
    }
  }
  return ids;
}
