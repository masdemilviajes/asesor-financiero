"use client";

import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { Plus } from "lucide-react";
import { FormError } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  type Account,
  type Category,
} from "@/lib/types";
import { addTransaction } from "./actions";
import { TransactionFields } from "./transaction-fields";

/** Botón grande "Agregar movimiento" que abre el formulario de captura manual. */
export function AddTransaction({
  today,
  accounts,
  categories,
}: {
  today: string;
  accounts: Pick<Account, "id" | "nombre">[];
  categories: Pick<Category, "id" | "nombre">[];
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, reset } = useFormAction(addTransaction, () => setOpen(false));

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
          <Button size="lg" className="h-12 w-full text-base sm:w-auto sm:px-5">
            <Plus aria-hidden /> Agregar movimiento
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>Registra un gasto o un ingreso a mano.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TransactionFields
            idPrefix="new"
            defaults={{ fecha: today }}
            accounts={accounts}
            categories={categories}
            autoFocus
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
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
