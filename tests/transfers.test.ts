import { describe, expect, it } from "vitest";
import { matchRules } from "@/lib/categorize";
import { looksLikeTransfer, pairTransfers, type PairCandidate } from "@/lib/transfers";

describe("palabras de transferencia propia o conversión", () => {
  it("reconoce traspasos entre cuentas propias, conversiones y pagos de tarjeta", () => {
    for (const text of [
      "INTERNAL TRANSFER 123456",
      "Transfer to Savings",
      "TRANSFER FROM NETBANK SAVER",
      "Transfer to my Goal Saver",
      "Traspaso entre cuentas propias",
      "Transferencia a cuenta propia",
      "Currency conversion AUD to EUR",
      "Converted 500.00 AUD to EUR",
      "Cambio de divisa",
      "Conversión de moneda USD",
      "CREDIT CARD PAYMENT",
      "Pago de tarjeta",
      "PAYMENT RECEIVED - THANK YOU",
    ]) {
      expect(looksLikeTransfer(text), text).toBe(true);
    }
  });

  it("no confunde pagos a otras personas ni compras normales", () => {
    for (const text of [
      "PAYID TRANSFER 8842 J SMITH",
      "TRANSFER TO JOHN SMITH RENT",
      "Transferencia a Maria Lopez",
      "WOOLWORTHS 1294 SYDNEY",
      "RENT PAYMENT REALESTATE AU",
      "SALARY ACME PTY LTD",
      "UBER *TRIP",
      "WISE PAYMENT TO LANDLORD",
    ]) {
      expect(looksLikeTransfer(text), text).toBe(false);
    }
  });
});

describe("emparejar salida y entrada entre cuentas", () => {
  const row = (id: string, fecha: string, monto: number, tipo: "gasto" | "ingreso", account_id: string | null, nuevo = true): PairCandidate =>
    ({ id, fecha, monto, tipo, account_id, nuevo });

  it("empareja el mismo monto en cuentas distintas con pocos días de diferencia", () => {
    const ids = pairTransfers([
      row("sale", "2026-11-10", 500, "gasto", "debito"),
      row("entra", "2026-11-11", 500, "ingreso", "ahorro", false),
      row("super", "2026-11-10", 80, "gasto", "debito"),
      row("sueldo", "2026-11-12", 2900, "ingreso", "debito"),
    ]);
    expect(ids.sort()).toEqual(["entra", "sale"]);
  });

  it("no empareja en la misma cuenta, ni con montos distintos, ni con muchos días", () => {
    expect(pairTransfers([row("a", "2026-11-10", 500, "gasto", "x"), row("b", "2026-11-10", 500, "ingreso", "x")])).toEqual([]);
    expect(pairTransfers([row("a", "2026-11-10", 500, "gasto", "x"), row("b", "2026-11-10", 499, "ingreso", "y")])).toEqual([]);
    expect(pairTransfers([row("a", "2026-11-10", 500, "gasto", "x"), row("b", "2026-11-15", 500, "ingreso", "y")])).toEqual([]);
    expect(pairTransfers([row("a", "2026-11-10", 500, "gasto", null), row("b", "2026-11-10", 500, "ingreso", "y")])).toEqual([]);
  });

  it("no toca parejas donde ningún lado es nuevo (respeta lo que ya decidió el usuario)", () => {
    expect(pairTransfers([row("a", "2026-11-10", 500, "gasto", "x", false), row("b", "2026-11-10", 500, "ingreso", "y", false)])).toEqual([]);
  });

  it("cada movimiento se usa una sola vez y se elige el más cercano en fecha", () => {
    const ids = pairTransfers([
      row("out1", "2026-11-10", 100, "gasto", "x"),
      row("out2", "2026-11-11", 100, "gasto", "x"),
      row("in-lejos", "2026-11-13", 100, "ingreso", "y"),
      row("in-cerca", "2026-11-10", 100, "ingreso", "y"),
    ]);
    expect(ids).toEqual(["out1", "in-cerca", "out2", "in-lejos"]);
  });
});

describe("reglas de transferencia", () => {
  it("una regla puede marcar transferencia en vez de categoría", () => {
    const rules = [
      { patron_texto: "wise", category_id: null, es_transferencia: true },
      { patron_texto: "wise landlord", category_id: "vivienda" },
    ];
    expect(matchRules("WISE AUD EUR 4411", rules)).toEqual({ kind: "transferencia" });
    // gana la más específica
    expect(matchRules("WISE PAYMENT LANDLORD", rules)).toEqual({ kind: "categoria", category_id: "vivienda" });
    expect(matchRules("COLES", rules)).toBeNull();
  });
});
