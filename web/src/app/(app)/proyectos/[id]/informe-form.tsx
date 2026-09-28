"use client";

import { useActionState } from "react";
import { updateInformeAction } from "@/app/actions/projects";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DatosInforme } from "@/lib/validation";

export function InformeForm({ projectId, informe }: { projectId: string; informe: Partial<DatosInforme> }) {
  const [state, action] = useActionState<ActionState, FormData>(updateInformeAction.bind(null, projectId), {});
  const fe = state.fieldErrors ?? {};
  const v: Record<string, string | undefined> = state.values ?? { version: "1.0", ...informe };
  const campo = (name: keyof DatosInforme, label: string, hint?: string, props?: React.ComponentProps<"input">) => (
    <Field label={label} htmlFor={name} hint={hint} error={fe[name]}>
      <Input id={name} name={name} defaultValue={v[name] ?? ""} {...props} />
    </Field>
  );
  return (
    <form action={action} className="grid gap-6">
      <FormError message={state.error} />
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Sitio y portada</legend>
        <Field
          label="Área de estudio (como se nombra en el texto)"
          htmlFor="areaEstudio"
          error={fe.areaEstudio}
          className="sm:col-span-3"
          hint="Se usa en frases como «…ubicados en ___». Ej.: el área de actividades de la Gerencia General de Activos con Socios, específicamente en el Campo Colorado"
        >
          <Input id="areaEstudio" name="areaEstudio" defaultValue={v.areaEstudio ?? ""} />
        </Field>
        {campo("municipio", "Municipio")}
        {campo("departamento", "Departamento")}
        {campo("expediente", "Expediente", "Encabezado. Vacío = «No aplica».")}
        <Field
          label="Título de la portada y del encabezado"
          htmlFor="titulo"
          error={fe.titulo}
          className="sm:col-span-2"
          hint="Un renglón por línea. Vacío = nombre del proyecto y cliente."
        >
          <Textarea id="titulo" name="titulo" rows={3} defaultValue={v.titulo ?? ""} />
        </Field>
        <div className="grid gap-4">
          {campo("version", "Versión del informe")}
          {campo("fecha", "Fecha del informe", "Vacío = fecha en que se genera.", { type: "date" })}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Información del cliente (Tabla 1)</legend>
        {campo("clienteNit", "NIT")}
        {campo("clienteCiudad", "Ciudad")}
        {campo("clienteDepartamento", "Departamento")}
        {campo("clienteDireccion", "Dirección")}
        <Field label="Contacto" htmlFor="clienteContacto" error={fe.clienteContacto} className="sm:col-span-2" hint="Nombre y teléfono.">
          <Input id="clienteContacto" name="clienteContacto" defaultValue={v.clienteContacto ?? ""} />
        </Field>
        <Field label="Actividad" htmlFor="clienteActividad" error={fe.clienteActividad} className="sm:col-span-3">
          <Textarea id="clienteActividad" name="clienteActividad" rows={2} defaultValue={v.clienteActividad ?? ""} />
        </Field>
      </fieldset>

      <div>
        <SubmitButton>Guardar datos del informe</SubmitButton>
      </div>
    </form>
  );
}
