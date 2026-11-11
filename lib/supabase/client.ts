import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes que corren en el navegador. */
export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
}
