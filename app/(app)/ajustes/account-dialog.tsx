"use client";

import { useState } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import { DeleteButton } from "@/components/delete-button";
import { Field, FormError, TOUCH_INPUT, TOUCH_SELECT } from "@/components/field";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
} from "@/lib/types";
import { deleteAccount, saveAccount } from "./actions";

export function AccountDialog({
  account,
  children,
}: {
  account?: Account;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<AccountType>(account?.tipo ?? "debito");
  const { state, pending, onSubmit, reset } = useFormAction(saveAccount, () => setOpen(false));

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
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            Nunca escribas el número completo de la tarjeta; solo los últimos 4 dígitos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {account ? <input type="hidden" name="id" value={account.id} /> : null}
          <Field label="Nombre" htmlFor="acc-nombre">
            <Input
              id="acc-nombre"
              name="nombre"
              defaultValue={account?.nombre}
              placeholder="Ej. Débito principal"
              required
              className={TOUCH_INPUT}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="acc-tipo">
              <NativeSelect
                id="acc-tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as AccountType)}
                className={TOUCH_SELECT}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Últimos 4 dígitos" htmlFor="acc-ultimos4">
              <Input
                id="acc-ultimos4"
                name="ultimos4"
                defaultValue={account?.ultimos4 ?? ""}
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="Opcional"
                className={TOUCH_INPUT}
              />
            </Field>
          </div>
          <Field
            label="Saldo actual"
            htmlFor="acc-saldo"
            hint={
              tipo === "credito"
                ? "En tarjetas de crédito, escribe lo que debes en negativo (ej. -1280)."
                : "Actualízalo cuando quieras; los movimientos no lo cambian solos."
            }
          >
            <Input
              id="acc-saldo"
              name="saldo_actual"
              defaultValue={account ? String(account.saldo_actual) : "0"}
              inputMode="decimal"
              required
              className={TOUCH_INPUT}
            />
          </Field>
          {tipo === "credito" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Día de corte" htmlFor="acc-corte">
                <Input
                  id="acc-corte"
                  name="dia_corte"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={account?.dia_corte ?? ""}
                  placeholder="1–31"
                  className={TOUCH_INPUT}
                />
              </Field>
              <Field label="Día límite de pago" htmlFor="acc-limite">
                <Input
                  id="acc-limite"
                  name="dia_limite_pago"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={account?.dia_limite_pago ?? ""}
                  placeholder="1–31"
                  className={TOUCH_INPUT}
                />
              </Field>
            </div>
          ) : null}
          <FormError message={state.error} />
          <div className="flex items-center justify-between gap-2">
            {account ? (
              <DeleteButton
                onDelete={() => deleteAccount(account.id)}
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
