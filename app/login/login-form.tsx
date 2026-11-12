"use client";

import { FormError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { login } from "./actions";

export function LoginForm() {
  const { state, pending, onSubmit } = useFormAction(login);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 text-base"
        />
      </div>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
