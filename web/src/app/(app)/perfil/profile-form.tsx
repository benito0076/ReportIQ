"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";

/** Nombre y cargo con los que el usuario firma «Elaboró» en los informes que genera. */
export function ProfileForm({
  action,
  values,
  idPrefijo = "",
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  values: { fullName: string; cargo: string };
  idPrefijo?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const v = state.values ?? values;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="grid gap-3">
      <FormError message={state.error} />
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor={`${idPrefijo}fullName`} error={fe.fullName} hint="Tal como debe aparecer en «Elaboró»." className="content-start">
          <Input id={`${idPrefijo}fullName`} name="fullName" defaultValue={v.fullName ?? ""} placeholder="Ing. Ana Pérez" />
        </Field>
        <Field label="Cargo" htmlFor={`${idPrefijo}cargo`} error={fe.cargo} className="content-start">
          <Input id={`${idPrefijo}cargo`} name="cargo" defaultValue={v.cargo ?? ""} placeholder="Ingeniera ambiental" />
        </Field>
      </div>
      <div>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </form>
  );
}
