"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";
import type { SettingsInput } from "@/lib/validation";

export function SettingsForm({ settings }: { settings: SettingsInput }) {
  const [state, action] = useActionState<ActionState, FormData>(updateSettingsAction, {});
  const v: Record<string, string> = state.values ?? settings;
  const fe = state.fieldErrors ?? {};
  const campo = (name: keyof SettingsInput, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint} error={fe[name]}>
      <Input id={name} name={name} defaultValue={v[name] ?? ""} />
    </Field>
  );
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.error} />
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Cuadro de control del informe Word</legend>
        {campo("elaboroNombre", "Elaboró", "Vacío = se deja el nombre de la plantilla.")}
        {campo("elaboroCargo", "Cargo de quien elaboró")}
        {campo("autorizoNombre", "Autorizó", "Vacío = se deja el nombre de la plantilla.")}
        {campo("autorizoCargo", "Cargo de quien autorizó")}
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">Mapas de isófonas y de localización</legend>
        {campo(
          "elaboradoPor",
          "Texto «Elaboró» de los planos",
          "Los planos muestran el logo de la empresa; este texto solo se usa si el logo no está disponible.",
        )}
      </fieldset>
      <div>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </form>
  );
}
