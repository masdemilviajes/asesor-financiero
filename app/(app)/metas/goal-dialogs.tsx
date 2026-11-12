"use client";

import { useState } from "react";
import { DeleteButton } from "@/components/delete-button";
import { Field, FormError, TOUCH_INPUT } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import type { Goal } from "@/lib/goals";
import { addContribution, deleteGoal, saveGoal } from "./actions";

/** Crear o editar una meta de ahorro. */
export function GoalDialog({
  goal,
  defaultDate,
  children,
}: {
  goal?: Goal;
  defaultDate: string;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, reset } = useFormAction(saveGoal, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>
            Con el objetivo y la fecha, la app calcula cuánto apartar cada semana.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
          <Field label="Nombre" htmlFor="goal-nombre">
            <Input
              id="goal-nombre"
              name="nombre"
              defaultValue={goal?.nombre}
              placeholder="Ej. Fondo de emergencia"
              required
              className={TOUCH_INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objetivo" htmlFor="goal-objetivo">
              <Input
                id="goal-objetivo"
                name="monto_objetivo"
                defaultValue={goal ? String(goal.monto_objetivo) : ""}
                inputMode="decimal"
                placeholder="0.00"
                required
                className={TOUCH_INPUT}
              />
            </Field>
            <Field label="Ya ahorrado" htmlFor="goal-actual">
              <Input
                id="goal-actual"
                name="monto_actual"
                defaultValue={goal ? String(goal.monto_actual) : "0"}
                inputMode="decimal"
                required
                className={TOUCH_INPUT}
              />
            </Field>
          </div>
          <Field label="Fecha objetivo" htmlFor="goal-fecha">
            <Input
              id="goal-fecha"
              name="fecha_objetivo"
              type="date"
              defaultValue={goal?.fecha_objetivo ?? defaultDate}
              required
              className={TOUCH_INPUT}
            />
          </Field>
          <FormError message={state.error} />
          <div className="flex items-center justify-between gap-2">
            {goal ? (
              <DeleteButton onDelete={() => deleteGoal(goal.id)} onDone={() => setOpen(false)} />
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" className="h-11 px-5" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Registrar una aportación a una meta. */
export function ContributionDialog({
  goal,
  today,
  suggested,
  children,
}: {
  goal: Goal;
  today: string;
  suggested: number;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, reset } = useFormAction(addContribution, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aportar a «{goal.nombre}»</DialogTitle>
          <DialogDescription>
            Se suma a lo ahorrado. Para registrar un retiro, escribe el monto en negativo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="goal_id" value={goal.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto" htmlFor="contrib-monto">
              <Input
                id="contrib-monto"
                name="monto"
                defaultValue={suggested > 0 ? suggested.toFixed(2) : ""}
                inputMode="decimal"
                placeholder="0.00"
                required
                autoFocus
                className={TOUCH_INPUT}
              />
            </Field>
            <Field label="Fecha" htmlFor="contrib-fecha">
              <Input
                id="contrib-fecha"
                name="fecha"
                type="date"
                defaultValue={today}
                required
                className={TOUCH_INPUT}
              />
            </Field>
          </div>
          <FormError message={state.error} />
          <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
            {pending ? "Guardando…" : "Registrar aportación"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
