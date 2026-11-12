"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { FormError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/config";
import { formatDay, plural } from "@/lib/format";
import type { Category, TransactionWithRefs } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resolveReview, runCategorization } from "./actions";

type CategoryOption = Pick<Category, "id" | "nombre" | "color_neutro">;

export function ReviewList({
  transactions,
  categories,
}: {
  transactions: TransactionWithRefs[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [categorizing, startCategorizing] = useTransition();

  const visible = transactions.filter((t) => !resolved.has(t.id));
  const needsAi = visible.some((t) => t.category_id === null && t.comercio === null);

  async function choose(t: TransactionWithRefs, categoryId: string | null) {
    setBusyId(t.id);
    setError(undefined);
    const result = await resolveReview(t.id, categoryId);
    setBusyId(null);
    if (!result.ok) return setError(result.error);

    setResolved((prev) => new Set(prev).add(t.id));
    const name = categories.find((c) => c.id === categoryId)?.nombre;
    setMessage(
      !name
        ? "Listo, quedó sin categoría."
        : result.extra > 1
          ? `Regla aprendida: también se ${result.extra - 1 === 1 ? "resolvió 1 movimiento parecido" : `resolvieron ${result.extra - 1} movimientos parecidos`} como ${name}.`
          : `Regla aprendida: la próxima vez irá a ${name}.`,
    );
    router.refresh();
  }

  function categorize() {
    setError(undefined);
    setMessage(undefined);
    startCategorizing(async () => {
      const result = await runCategorization();
      if (!result.ok) return setError(result.error);
      setMessage(
        `Categorizados: ${result.porReglas} por tus reglas y ${result.porIA} por la IA. ` +
          `${plural(result.porRevisar, "queda", "quedan")} por revisar.`,
      );
      if (result.aviso) setError(result.aviso);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {visible.length === 0
            ? "No hay nada por revisar."
            : plural(visible.length, "movimiento pendiente", "movimientos pendientes")}
        </p>
        {needsAi ? (
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-5"
            disabled={categorizing}
            onClick={categorize}
          >
            <Sparkles aria-hidden />
            {categorizing ? "Categorizando…" : "Categorizar con IA"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}
      <FormError message={error} />

      <ul className="flex flex-col gap-3">
        {visible.map((t) => (
          <li key={t.id}>
            <Card size="sm" className={cn(busyId === t.id && "opacity-60")}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.comercio || t.descripcion_original}</p>
                    <p className="text-xs break-words text-muted-foreground">
                      {t.comercio && t.comercio !== t.descripcion_original
                        ? `${t.descripcion_original} · `
                        : ""}
                      <span className="inline-block first-letter:uppercase">{formatDay(t.fecha)}</span>
                      {t.accounts ? ` · ${t.accounts.nombre}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">−{formatMoney(t.monto)}</p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Elegir categoría">
                  {categories.map((c) => {
                    const suggested = t.category_id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => choose(t, c.id)}
                        className={cn(
                          "min-h-10 rounded-full border px-3.5 text-sm transition-colors hover:bg-muted disabled:pointer-events-none",
                          suggested &&
                            "border-foreground bg-foreground text-background hover:bg-foreground/85",
                        )}
                      >
                        {c.nombre}
                        {suggested ? <span className="sr-only"> (sugerida)</span> : null}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => choose(t, null)}
                    className="min-h-10 rounded-full border border-dashed px-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none"
                  >
                    Sin categoría
                  </button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
