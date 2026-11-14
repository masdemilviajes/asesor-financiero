// Reglas de categorización: funciones puras (sin red ni base de datos).

export type Rule = {
  patron_texto: string;
  category_id: string | null;
  /** La regla marca el movimiento como transferencia (no gasto ni ingreso). */
  es_transferencia?: boolean;
};

export type RuleMatch =
  | { kind: "categoria"; category_id: string }
  | { kind: "transferencia" };

/** Palabras de una descripción, en minúsculas, sin acentos ni símbolos. */
export function tokens(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Patrón que se guarda como regla cuando el usuario corrige un movimiento:
 * las primeras 3 palabras sin números ("WOOLWORTHS 1294 SYDNEY" → "woolworths sydney").
 */
export function rulePattern(description: string): string {
  return tokens(description)
    .filter((t) => t.length >= 2 && !/\d/.test(t))
    .slice(0, 3)
    .join(" ");
}

/**
 * Qué dicen las reglas sobre una descripción, o null si ninguna coincide.
 * Una regla coincide si todas sus palabras aparecen en la descripción;
 * si coinciden varias, gana la más específica (más palabras).
 */
export function matchRules(description: string, rules: Rule[]): RuleMatch | null {
  const words = new Set(tokens(description));
  let best: { size: number; match: RuleMatch } | null = null;
  for (const rule of rules) {
    const pattern = tokens(rule.patron_texto);
    if (pattern.length === 0 || !pattern.every((t) => words.has(t))) continue;
    const match: RuleMatch | null = rule.es_transferencia
      ? { kind: "transferencia" }
      : rule.category_id
        ? { kind: "categoria", category_id: rule.category_id }
        : null;
    if (match && (!best || pattern.length > best.size)) best = { size: pattern.length, match };
  }
  return best?.match ?? null;
}

/** Categoría que corresponde a una descripción según las reglas, o null. */
export function applyRules(description: string, rules: Rule[]): string | null {
  const match = matchRules(description, rules);
  return match?.kind === "categoria" ? match.category_id : null;
}
