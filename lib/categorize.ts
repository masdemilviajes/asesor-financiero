// Reglas de categorización: funciones puras (sin red ni base de datos).

export type Rule = { patron_texto: string; category_id: string };

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
 * Patrón que se guarda como regla cuando el usuario corrige una categoría:
 * las primeras 3 palabras sin números ("WOOLWORTHS 1294 SYDNEY" → "woolworths sydney").
 */
export function rulePattern(description: string): string {
  return tokens(description)
    .filter((t) => t.length >= 2 && !/\d/.test(t))
    .slice(0, 3)
    .join(" ");
}

/**
 * Categoría que corresponde a una descripción según las reglas, o null.
 * Una regla coincide si todas sus palabras aparecen en la descripción;
 * si coinciden varias, gana la más específica (más palabras).
 */
export function applyRules(description: string, rules: Rule[]): string | null {
  const words = new Set(tokens(description));
  let best: { size: number; category_id: string } | null = null;
  for (const rule of rules) {
    const pattern = tokens(rule.patron_texto);
    if (pattern.length === 0 || !pattern.every((t) => words.has(t))) continue;
    if (!best || pattern.length > best.size) {
      best = { size: pattern.length, category_id: rule.category_id };
    }
  }
  return best?.category_id ?? null;
}
