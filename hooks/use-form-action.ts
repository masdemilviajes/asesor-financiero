"use client";

import { useCallback, useState, useTransition } from "react";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Envía un formulario a una acción de servidor sin borrar lo que el usuario
 * escribió cuando hay un error (el `action` nativo de React reinicia el
 * formulario después de cada envío).
 */
export function useFormAction(action: ServerAction, onSuccess?: () => void) {
  const [state, setState] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [pending, startTransition] = useTransition();

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // Incluye el botón que se pulsó (p. ej. "guardar de todos modos").
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const formData = new FormData(event.currentTarget, submitter);
      startTransition(async () => {
        const result = await action(INITIAL_ACTION_STATE, formData);
        setState(result);
        if (result.ok) onSuccess?.();
      });
    },
    [action, onSuccess],
  );

  const reset = useCallback(() => setState(INITIAL_ACTION_STATE), []);

  return { state, pending, onSubmit, reset };
}
