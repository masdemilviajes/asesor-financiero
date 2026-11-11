"use client";

import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { Repeat2 } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { FormError } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/config";
import {
  type Account,
  type Category,
  type TransactionWithRefs,
} from "@/lib/types";
import { deleteTransaction, updateTransaction } from "./actions";
import { TransactionFields } from "./transaction-fields";

/** Fila de la lista de movimientos; al tocarla se abre el editor. */
export function TransactionRow({
  transaction: t,
  accounts,
  categories,
}: {
  transaction: TransactionWithRefs;
  accounts: Pick<Account, "id" | "nombre">[];
  categories: Pick<Category, "id" | "nombre">[];
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, reset } = useFormAction(updateTransaction, () => setOpen(false));

  const titulo = t.comercio || t.descripcion_original;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium">{titulo}</span>
                {t.es_recurrente ? (
                  <Repeat2 className="size-3.5 shrink-0 text-muted-foreground" aria-label="Recurrente" />
                ) : null}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {t.categories ? (
                  <span className="flex items-center gap-1">
                    <span
                      aria-hidden
                      className="size-2 rounded-full border border-border"
                      style={{ backgroundColor: t.categories.color_neutro }}
                    />
                    {t.categories.nombre}
                  </span>
                ) : t.tipo === "gasto" ? (
                  <Badge variant="outline">Por revisar</Badge>
                ) : (
                  <span>Ingreso</span>
                )}
                {t.accounts ? <span>· {t.accounts.nombre}</span> : null}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              {t.tipo === "ingreso" ? "+" : "−"}
              {formatMoney(t.monto)}
            </span>
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription className="break-words">
            Texto original: {t.descripcion_original}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={t.id} />
          <TransactionFields
            idPrefix={`edit-${t.id}`}
            defaults={{
              fecha: t.fecha,
              descripcion: titulo,
              monto: String(t.monto),
              tipo: t.tipo,
              account_id: t.account_id,
              category_id: t.category_id,
            }}
            accounts={accounts}
            categories={categories}
          />
          <FormError message={state.error} />
          <div className="flex items-center justify-between gap-2">
            <DeleteButton
              onDelete={() => deleteTransaction(t.id)}
              onDone={() => setOpen(false)}
            />
            <Button type="submit" size="lg" className="h-11 px-5" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
