"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/types";

/** Botón de borrar que pide confirmación con un segundo toque. */
export function DeleteButton({
  onDelete,
  onDone,
  label = "Borrar",
}: {
  onDelete: () => Promise<ActionState>;
  onDone?: () => void;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="h-11 text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await onDelete();
            if (result.ok) onDone?.();
            else setError(result.error);
          })
        }
      >
        {pending ? "Borrando…" : "Sí, borrar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="h-11"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancelar
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
