// Colores de las gráficas. Paleta neutra; el rojo se usa solo para "excedido".
// (Las gráficas SVG necesitan valores fijos, no variables CSS.)
export const CHART = {
  ink: "#262626", // gastado
  muted: "#d4d4d4", // presupuesto
  red: "#e7000b", // excedido (mismo tono que --destructive)
  grid: "#ececec",
  text: "#737373",
  surface: "#ffffff",
} as const;

/**
 * Colores vivos del gráfico de sectores, uno fijo por categoría.
 * El orden importa: está validado para que los vecinos se distingan bien,
 * también con daltonismo. No incluye rojo, que se reserva para "excedido".
 */
export const CATEGORY_COLORS = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // verde agua
  "#eda100", // amarillo
  "#e87ba4", // rosa
  "#008300", // verde
  "#6250d6", // violeta
  "#9c5b2e", // marrón
] as const;

/** Color para lo que no cabe en la paleta (a partir de la novena categoría). */
export const OTHER_COLOR = "#a3a3a3";
