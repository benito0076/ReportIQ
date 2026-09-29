"use client";

import { useActionState } from "react";
import { createProjectAction, updateProjectAction } from "@/app/actions/projects";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@/db/enums";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";

export function ProjectForm({
  project,
}: {
  project?: { id: string; nombre: string; cliente: string; codigoInforme: string };
}) {
  const action = project ? updateProjectAction.bind(null, project.id) : createProjectAction;
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
      <Field label="Código de informe" htmlFor="codigoInforme" error={fe.codigoInforme} hint="Ej.: ER-731-26">
        <Input id="codigoInforme" name="codigoInforme" defaultValue={v.codigoInforme} />
      </Field>
      {!project && (
        <Field label="Tipo de estudio" htmlFor="tipo" hint="No se puede cambiar después de crear el proyecto.">
          <select id="tipo" name="tipo" defaultValue={state.values?.tipo ?? "ambiental"} className={selectClass}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className={project ? "sm:col-span-3" : ""}>
        <SubmitButton>{project ? "Guardar datos" : "Crear proyecto"}</SubmitButton>
      </div>
    </form>
  );
}
