import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Asesor Financiero</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Inicia sesión para ver tus finanzas.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
