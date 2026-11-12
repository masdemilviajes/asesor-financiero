"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FormError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/config";

type Suggestion = {
  resumen: string;
  recortes: { categoria: string; recorte_semanal: number; como: string }[];
  total_semanal: number;
  necesario_semanal: number;
};

/** "¿De dónde saco la diferencia?": propuesta de la IA con montos por categoría. */
export function SuggestButton({ goalId }: { goalId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  async function ask() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/goals/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal_id: goalId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error ?? "No pude preparar la propuesta.");
      else setSuggestion(data as Suggestion);
    } catch {
      setError("No hay conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="lg" className="h-11 px-4" disabled={loading} onClick={ask}>
        <Sparkles aria-hidden />
        {loading ? "Pensando…" : "¿De dónde saco la diferencia?"}
      </Button>
      <FormError message={error} />
      {suggestion ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 text-sm" role="status">
          <p>{suggestion.resumen}</p>
          {suggestion.recortes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {suggestion.recortes.map((r) => (
                <li key={r.categoria} className="flex flex-col gap-0.5">
                  <span className="flex justify-between gap-3 font-medium">
                    <span>{r.categoria}</span>
                    <span className="shrink-0 tabular-nums">
                      −{formatMoney(r.recorte_semanal)} / semana
                    </span>
                  </span>
                  <span className="text-muted-foreground">{r.como}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="border-t pt-2 text-muted-foreground">
            Total propuesto: <span className="font-medium text-foreground tabular-nums">{formatMoney(suggestion.total_semanal)}</span>{" "}
            por semana, de los {formatMoney(suggestion.necesario_semanal)} que faltan.
          </p>
        </div>
      ) : null}
    </div>
  );
}
