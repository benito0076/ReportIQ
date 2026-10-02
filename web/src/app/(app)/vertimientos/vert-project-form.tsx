"use client";

import { useActionState } from "react";
import { createVertProjectAction, updateVertProjectAction } from "@/app/actions/vertimientos";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";

export function VertProjectForm({
  project,
}: {
  project?: { id: string; nombre: string; cliente: string; codigoInforme: string };
}) {
  const action = project ? updateVertProjectAction.bind(null, project.id) : createVertProjectAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? project ?? {};
  return (
    <form action={formAction} className={project ? "grid items-start gap-4 sm:grid-cols-3" : "grid gap-4"}>
      {state.error && <FormError message={state.error} />}
      {state.ok && state.message && <Notice tone="success" className="sm:col-span-3">{state.message}</Notice>}
      <Field label="Nombre del proyecto" htmlFor="nombre" required error={fe.nombre}>
        <Input id="nombre" name="nombre" required defaultValue={v.nombre} />
      </Field>
      <Field label="Cliente" htmlFor="cliente" error={fe.cliente}>
        <Input id="cliente" name="cliente" defaultValue={v.cliente} />
      </Field>
      <Field label="Código del informe" htmlFor="codigoInforme" error={fe.codigoInforme} hint="Ej.: EA-144-26">
        <Input id="codigoInforme" name="codigoInforme" defaultValue={v.codigoInforme} />
      </Field>
      <div className={project ? "sm:col-span-3" : ""}>
        <SubmitButton>{project ? "Guardar datos" : "Crear proyecto"}</SubmitButton>
      </div>
    </form>
  );
}
