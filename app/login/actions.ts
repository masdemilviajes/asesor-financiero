"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Escribe tu correo y tu contraseña." };
  }

  // App de un solo usuario: solo el correo permitido puede entrar.
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (allowed && email !== allowed) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials") {
      return { ok: false, error: "Correo o contraseña incorrectos." };
    }
    // Cualquier otro fallo suele ser de configuración (llave o URL de Supabase).
    return {
      ok: false,
      error: `No pude conectar con Supabase (${error.message}). Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.`,
    };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
