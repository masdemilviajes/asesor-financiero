"use client";

import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
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
import {
  NEUTRAL_COLORS,
  type Category,
} from "@/lib/types";
import { deleteCategory, saveCategory } from "./actions";

export function CategoryDialog({
  category,
  children,
}: {
  category?: Category;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, reset } = useFormAction(saveCategory, () => setOpen(false));

  const currentColor = category?.color_neutro ?? NEUTRAL_COLORS[3];

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
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            El presupuesto mensual es lo máximo que quieres gastar en esta categoría.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <Field label="Nombre" htmlFor="cat-nombre">
            <Input
              id="cat-nombre"
              name="nombre"
              defaultValue={category?.nombre}
              placeholder="Ej. Supermercado"
              required
              className={TOUCH_INPUT}
            />
          </Field>
          <Field label="Presupuesto mensual" htmlFor="cat-presupuesto">
            <Input
              id="cat-presupuesto"
              name="presupuesto_mensual"
              defaultValue={category ? String(category.presupuesto_mensual) : ""}
              inputMode="decimal"
              placeholder="0.00"
              required
              className={TOUCH_INPUT}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Tono en las gráficas</legend>
            <div className="flex flex-wrap gap-2">
              {NEUTRAL_COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color_neutro"
                    value={color}
                    defaultChecked={color === currentColor}
                    className="peer sr-only"
                  />
                  <span
                    aria-label={`Tono ${color}`}
                    className="block size-9 rounded-full border border-border ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                    style={{ backgroundColor: color }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <FormError message={state.error} />
          <div className="flex items-center justify-between gap-2">
            {category ? (
              <DeleteButton
                onDelete={() => deleteCategory(category.id)}
                onDone={() => setOpen(false)}
              />
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
