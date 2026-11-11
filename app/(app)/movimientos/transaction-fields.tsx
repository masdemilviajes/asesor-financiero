"use client";

import { useState } from "react";
import { Field, TOUCH_INPUT, TOUCH_SELECT } from "@/components/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { Account, Category, TransactionType } from "@/lib/types";

export type TransactionDefaults = {
  fecha: string;
  descripcion?: string;
  monto?: string;
  tipo?: TransactionType;
  account_id?: string | null;
  category_id?: string | null;
};

/** Campos compartidos por el formulario de captura y el de edición. */
export function TransactionFields({
  idPrefix,
  defaults,
  accounts,
  categories,
  autoFocus,
}: {
  idPrefix: string;
  defaults: TransactionDefaults;
  accounts: Pick<Account, "id" | "nombre">[];
  categories: Pick<Category, "id" | "nombre">[];
  autoFocus?: boolean;
}) {
  const [tipo, setTipo] = useState<TransactionType>(defaults.tipo ?? "gasto");

  return (
    <>
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Tipo">
        {(["gasto", "ingreso"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tipo === t}
            onClick={() => setTipo(t)}
            className={cn(
              "h-10 rounded-md text-sm font-medium text-muted-foreground transition-colors",
              tipo === t && "bg-background text-foreground shadow-sm",
            )}
          >
            {t === "gasto" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto" htmlFor={`${idPrefix}-monto`}>
          <Input
            id={`${idPrefix}-monto`}
            name="monto"
            defaultValue={defaults.monto}
            inputMode="decimal"
            placeholder="0.00"
            required
            autoFocus={autoFocus}
            className={cn(TOUCH_INPUT, "tabular-nums")}
          />
        </Field>
        <Field label="Fecha" htmlFor={`${idPrefix}-fecha`}>
          <Input
            id={`${idPrefix}-fecha`}
            name="fecha"
            type="date"
            defaultValue={defaults.fecha}
            required
            className={TOUCH_INPUT}
          />
        </Field>
      </div>

      <Field label="Descripción" htmlFor={`${idPrefix}-descripcion`}>
        <Input
          id={`${idPrefix}-descripcion`}
          name="descripcion"
          defaultValue={defaults.descripcion}
          placeholder="Ej. Súper, gasolina, café"
          required
          className={TOUCH_INPUT}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cuenta" htmlFor={`${idPrefix}-cuenta`}>
          <NativeSelect
            id={`${idPrefix}-cuenta`}
            name="account_id"
            defaultValue={defaults.account_id ?? ""}
            className={TOUCH_SELECT}
          >
            <NativeSelectOption value="">Sin cuenta</NativeSelectOption>
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Categoría" htmlFor={`${idPrefix}-categoria`}>
          <NativeSelect
            id={`${idPrefix}-categoria`}
            name="category_id"
            defaultValue={defaults.category_id ?? ""}
            className={TOUCH_SELECT}
          >
            <NativeSelectOption value="">Sin categoría</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.nombre}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </>
  );
}
