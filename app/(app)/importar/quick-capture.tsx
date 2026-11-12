"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { FormError, TOUCH_INPUT } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { formatMoney } from "@/lib/config";
import type { TransactionType } from "@/lib/types";
import { addTransaction } from "../movimientos/actions";
import { TransactionFields } from "../movimientos/transaction-fields";
import type { ImportContext } from "./import-tabs";

type Interpreted = {
  monto: number;
  descripcion: string;
  tipo: TransactionType;
  fecha: string;
  account_id: string | null;
  category_id: string | null;
};

/** Captura en una línea, p. ej. "350 súper con débito", interpretada con IA. */
export function QuickCapture({ accounts, categories }: ImportContext) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Interpreted | null>(null);
  const [saved, setSaved] = useState<string>();

  const { state, pending, onSubmit, reset } = useFormAction(addTransaction, () => {
    if (result) setSaved(`${result.descripcion} · ${formatMoney(result.monto)}`);
    setResult(null);
    setTexto("");
  });

  async function interpret(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setSaved(undefined);
    setResult(null);
    reset();
    try {
      const response = await fetch("/api/import/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "No pude interpretar el texto.");
      else setResult(data as Interpreted);
    } catch {
      setError("No hay conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Captura rápida</CardTitle>
        <CardDescription>
          Escribe el movimiento en una línea, como «350 súper con débito» o «cobré 1200 de
          sueldo ayer».
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={interpret} className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Movimiento en una línea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="350 súper con débito"
            maxLength={300}
            required
            className={TOUCH_INPUT}
          />
          <Button
            type="submit"
            size="lg"
            className="h-11 shrink-0 px-5 text-base"
            disabled={loading || texto.trim().length < 2}
          >
            <Sparkles aria-hidden />
            {loading ? "Interpretando…" : "Interpretar"}
          </Button>
        </form>

        <FormError message={error} />

        {saved ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Check className="size-4" aria-hidden /> Guardado: {saved}
          </p>
        ) : null}

        {result ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Esto fue lo que entendí. Corrige lo que haga falta y guarda.
            </p>
            <TransactionFields
              idPrefix="quick"
              defaults={{
                fecha: result.fecha,
                descripcion: result.descripcion,
                monto: String(result.monto),
                tipo: result.tipo,
                account_id: result.account_id,
                category_id: result.category_id,
              }}
              accounts={accounts}
              categories={categories}
            />
            <FormError message={state.error} />
            {state.duplicate ? (
              <Button
                type="submit"
                name="forzar"
                value="1"
                variant="outline"
                size="lg"
                className="h-11"
                disabled={pending}
              >
                No es duplicado, guardar de todos modos
              </Button>
            ) : null}
            <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
              {pending ? "Guardando…" : "Guardar movimiento"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
