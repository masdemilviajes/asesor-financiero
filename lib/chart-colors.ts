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
