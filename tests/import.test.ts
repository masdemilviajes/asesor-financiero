import { describe, expect, it } from "vitest";
import {
  buildTransactions,
  detectColumns,
  detectDateOrder,
  maskSensitive,
  parseCellAmount,
  parseDate,
  singleSign,
} from "@/lib/import/parse";
import { occurrenceHash, transactionHash } from "@/lib/hash";
import { findRecurringIds, merchantKey } from "@/lib/recurring";

describe("parseDate", () => {
  it("lee los formatos habituales", () => {
    expect(parseDate("2026-11-05")).toBe("2026-11-05");
    expect(parseDate("05/11/2026")).toBe("2026-11-05");
    expect(parseDate("05/11/2026", "mdy")).toBe("2026-05-11");
    expect(parseDate("5-11-26")).toBe("2026-11-05");
    expect(parseDate("12 Nov 2026")).toBe("2026-11-12");
    expect(parseDate("12-nov-26")).toBe("2026-11-12");
    expect(parseDate("Nov 12, 2026")).toBe("2026-11-12");
    expect(parseDate("3 ene 2026")).toBe("2026-01-03");
    expect(parseDate(new Date(Date.UTC(2026, 10, 12)))).toBe("2026-11-12");
  });
  it("rechaza lo que no es fecha", () => {
    expect(parseDate("WOOLWORTHS 1294")).toBeNull();
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("-45.20")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("detectDateOrder", () => {
  it("distingue día/mes de mes/día", () => {
    expect(detectDateOrder(["01/02/2026", "25/02/2026"])).toBe("dmy");
    expect(detectDateOrder(["01/02/2026", "02/25/2026"])).toBe("mdy");
    expect(detectDateOrder(["01/02/2026"])).toBe("dmy");
  });
});

describe("parseCellAmount", () => {
  it("lee montos con símbolos y negativos", () => {
    expect(parseCellAmount("$1,234.50")).toBe(1234.5);
    expect(parseCellAmount("-45.20")).toBe(-45.2);
    expect(parseCellAmount("(45.20)")).toBe(-45.2);
    expect(parseCellAmount("45.20-")).toBe(-45.2);
    expect(parseCellAmount(12)).toBe(12);
    expect(parseCellAmount("Coles")).toBeNaN();
    expect(parseCellAmount("")).toBeNaN();
  });
});

describe("detectColumns + buildTransactions", () => {
  it("CSV con encabezado y una columna de monto con signo", () => {
    const rows = [
      ["Date", "Description", "Amount", "Balance"],
      ["05/11/2026", "WOOLWORTHS 1294 SYDNEY", "-85.40", "3,364.60"],
      ["06/11/2026", "SALARY ACME PTY LTD", "2,900.00", "6,264.60"],
      ["25/11/2026", "UBER *TRIP", "-23.10", "6,241.50"],
    ];
    const mapping = detectColumns(rows);
    expect(mapping).toMatchObject({ hasHeader: true, fecha: 0, descripcion: 1, monto: 2, signo: "negativo_gasto", dateOrder: "dmy" });
    const { rows: out, skipped } = buildTransactions(rows, mapping);
    expect(skipped).toBe(0);
    expect(out).toEqual([
      { fecha: "2026-11-05", descripcion: "WOOLWORTHS 1294 SYDNEY", monto: 85.4, tipo: "gasto" },
      { fecha: "2026-11-06", descripcion: "SALARY ACME PTY LTD", monto: 2900, tipo: "ingreso" },
      { fecha: "2026-11-25", descripcion: "UBER *TRIP", monto: 23.1, tipo: "gasto" },
    ]);
  });

  it("CSV sin encabezado (estilo banco australiano): fecha, monto, descripción, saldo", () => {
    const rows = [
      ["05/11/2026", "-85.40", "WOOLWORTHS 1294 SYDNEY", "+3364.60"],
      ["06/11/2026", "+2900.00", "SALARY ACME PTY LTD", "+6264.60"],
    ];
    const mapping = detectColumns(rows);
    expect(mapping).toMatchObject({ hasHeader: false, fecha: 0, monto: 1, descripcion: 2 });
    expect(buildTransactions(rows, mapping).rows.map((r) => r.tipo)).toEqual(["gasto", "ingreso"]);
  });

  it("columnas separadas de cargo y abono en español", () => {
    const rows = [
      ["Fecha", "Concepto", "Cargo", "Abono", "Saldo"],
      ["2026-11-05", "SUPER", "350.00", "", "1000"],
      ["2026-11-06", "NOMINA", "", "5000.00", "6000"],
      ["", "Total", "", "", ""],
    ];
    const mapping = detectColumns(rows);
    expect(mapping).toMatchObject({ fecha: 0, descripcion: 1, cargo: 2, abono: 3, monto: null });
    const { rows: out, skipped } = buildTransactions(rows, mapping);
    expect(out.map((r) => [r.monto, r.tipo])).toEqual([[350, "gasto"], [5000, "ingreso"]]);
    expect(skipped).toBe(1);
  });

  it("tarjeta de crédito con todos los montos positivos: todo son gastos", () => {
    const rows = [
      ["Fecha", "Descripción", "Importe"],
      ["01/11/2026", "NETFLIX", "16.99"],
      ["02/11/2026", "AMAZON", "54.00"],
    ];
    const mapping = detectColumns(rows);
    expect(mapping.signo).toBe("positivo_gasto");
    expect(buildTransactions(rows, mapping).rows.every((r) => r.tipo === "gasto")).toBe(true);
  });

  it("cuenta de ahorro con solo depósitos positivos: son ingresos, no gastos", () => {
    const rows = [
      ["Date", "Description", "Amount"],
      ["12/11/2026", "DEPOSIT 7781", "200.00"],
      ["12/11/2026", "INTEREST PAID", "3.10"],
    ];
    const mapping = detectColumns(rows);
    expect(mapping.signo).toBe("negativo_gasto");
    expect(singleSign(rows, mapping)).toBe(true);
    expect(buildTransactions(rows, mapping).rows.map((r) => r.tipo)).toEqual(["ingreso", "ingreso"]);
  });

  it("singleSign es falso cuando hay montos de ambos signos", () => {
    const rows = [["01/11/2026", "-5.00", "CAFE"], ["02/11/2026", "50.00", "REFUND"]];
    expect(singleSign(rows, detectColumns(rows))).toBe(false);
  });

  it("fechas de Excel (objetos Date) y montos numéricos", () => {
    const rows = [
      ["Fecha", "Detalle", "Monto"],
      [new Date(Date.UTC(2026, 10, 5)), "Café", -4.5],
    ];
    const out = buildTransactions(rows, detectColumns(rows)).rows;
    expect(out).toEqual([{ fecha: "2026-11-05", descripcion: "Café", monto: 4.5, tipo: "gasto" }]);
  });
});

describe("maskSensitive", () => {
  it("deja solo los últimos 4 dígitos de números largos", () => {
    expect(maskSensitive("PAGO TARJETA 4539 1488 0343 6467")).toBe("PAGO TARJETA ••••6467");
    expect(maskSensitive("CTA 123456789012 REF")).toBe("CTA ••••9012 REF");
    expect(maskSensitive("WOOLWORTHS 1294 SYDNEY")).toBe("WOOLWORTHS 1294 SYDNEY");
    expect(maskSensitive("05/11/2026 350.00")).toBe("05/11/2026 350.00");
  });
});

describe("huellas", () => {
  it("misma fecha, monto y descripción dan la misma huella", () => {
    expect(transactionHash("2026-11-05", 85.4, " Woolworths  1294 ")).toBe(
      transactionHash("2026-11-05", 85.4, "woolworths 1294"),
    );
    expect(transactionHash("2026-11-05", 85.4, "a")).not.toBe(transactionHash("2026-11-06", 85.4, "a"));
  });
  it("la segunda aparición en el mismo archivo tiene otra huella, estable", () => {
    const first = occurrenceHash("2026-11-05", 4.5, "Café", 1);
    const second = occurrenceHash("2026-11-05", 4.5, "Café", 2);
    expect(first).toBe(transactionHash("2026-11-05", 4.5, "Café"));
    expect(second).not.toBe(first);
    expect(second).toBe(occurrenceHash("2026-11-05", 4.5, "Café", 2));
  });
});

describe("recurrentes", () => {
  const tx = (id: string, fecha: string, monto: number, comercio: string) => ({
    id, fecha, monto, comercio, descripcion_original: comercio,
  });
  it("agrupa por comercio ignorando números", () => {
    expect(merchantKey("NETFLIX.COM 8842 SYDNEY")).toBe("netflix com sydney");
    expect(merchantKey("SPOTIFY P1A2B3C4")).toBe("spotify");
  });
  it("marca cargos mensuales de monto similar y no las compras frecuentes", () => {
    const ids = findRecurringIds([
      tx("n1", "2026-09-08", 16.99, "Netflix"),
      tx("n2", "2026-10-08", 16.99, "Netflix"),
      tx("n3", "2026-11-08", 17.99, "Netflix"),
      tx("e1", "2026-09-12", 110, "Electricidad"),
      tx("e2", "2026-10-12", 180, "Electricidad"),
      tx("e3", "2026-11-12", 60, "Electricidad"),
      tx("s1", "2026-09-01", 90, "Woolworths"),
      tx("s2", "2026-09-09", 92, "Woolworths"),
      tx("s3", "2026-09-20", 91, "Woolworths"),
      tx("s4", "2026-10-03", 90, "Woolworths"),
      tx("s5", "2026-11-04", 93, "Woolworths"),
      tx("g1", "2026-10-03", 65, "Gimnasio"),
      tx("g2", "2026-11-03", 65, "Gimnasio"),
    ]);
    expect(ids.sort()).toEqual(["n1", "n2", "n3"]);
  });
  it("acepta un recibo mensual que varía poco y descarta compras mensuales de monto variable", () => {
    const meses = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
    const luz = [139.98, 141.12, 130.53, 130.29, 119.2, 134.72];
    const tienda = [86.97, 80.55, 85.69, 59.04, 115.09, 117.92];
    const ids = findRecurringIds([
      ...meses.map((m, i) => tx(`luz${i}`, `${m}-12`, luz[i], "Energy Australia")),
      ...meses.map((m, i) => tx(`tienda${i}`, `${m}-07`, tienda[i], "Amazon")),
    ]);
    expect(ids.sort()).toEqual(["luz0", "luz1", "luz2", "luz3", "luz5"]);
  });
});
