import { describe, expect, it } from "vitest";
import { applyRules, rulePattern, tokens } from "@/lib/categorize";

describe("reglas de categorización", () => {
  it("normaliza acentos, mayúsculas y símbolos", () => {
    expect(tokens("SQ *CAMPOS Café, 0921")).toEqual(["sq", "campos", "cafe", "0921"]);
  });

  it("genera el patrón con las primeras palabras sin números", () => {
    expect(rulePattern("WOOLWORTHS 1294 SYDNEY")).toBe("woolworths sydney");
    expect(rulePattern("UBER *EATS ORDER 5521")).toBe("uber eats order");
    expect(rulePattern("PAYPAL *DIGITALSVC 4029357733")).toBe("paypal digitalsvc");
    expect(rulePattern("1234 5678")).toBe("");
  });

  it("coincide aunque cambien los números de sucursal o el orden de otras palabras", () => {
    const rules = [{ patron_texto: "woolworths sydney", category_id: "super" }];
    expect(applyRules("WOOLWORTHS 0871 SYDNEY NSW", rules)).toBe("super");
    expect(applyRules("Woolworths Melbourne", rules)).toBeNull();
    expect(applyRules("COLES 0871 NEWTOWN", rules)).toBeNull();
  });

  it("si coinciden varias reglas gana la más específica", () => {
    const rules = [
      { patron_texto: "uber", category_id: "transporte" },
      { patron_texto: "uber eats", category_id: "restaurantes" },
    ];
    expect(applyRules("UBER *EATS PENDING", rules)).toBe("restaurantes");
    expect(applyRules("UBER *TRIP", rules)).toBe("transporte");
  });

  it("una regla vacía nunca coincide", () => {
    expect(applyRules("cualquier cosa", [{ patron_texto: "", category_id: "x" }])).toBeNull();
  });
});
