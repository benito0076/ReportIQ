"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";

export function SettingsForm({ elaboradoPor }: { elaboradoPor: string }) {
  const [state, action] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  return (
    <form action={action} className="grid gap-3">
      <FormError message={state.error} />
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <Field label="Elaboró" htmlFor="elaboradoPor" hint="Vacío = AMBIENCIQ INGENIEROS S.A.S." error={state.fieldErrors?.elaboradoPor}>
        <Input id="elaboradoPor" name="elaboradoPor" defaultValue={state.values?.elaboradoPor ?? elaboradoPor} />
      </Field>
      <div>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </form>
  );
}
