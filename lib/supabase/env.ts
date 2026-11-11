// Lee las variables públicas de Supabase y corrige errores típicos al
// pegarlas: comillas, espacios o una ruta sobrante (p. ej. /rest/v1/).

function clean(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

function normalizeUrl(raw: string | undefined): string {
  const value = clean(raw);
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch {
    return "";
  }
}

/** Valor tal cual se escribió, para poder mostrarlo en mensajes de error. */
export const RAW_SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Dirección del proyecto, p. ej. https://xxxxxxxx.supabase.co ("" si no es válida). */
export const SUPABASE_URL = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Llave pública (publishable / anon). */
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
