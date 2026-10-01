"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStationAction, updateStationAction } from "@/app/actions/aire";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AirStation } from "@/db/schema";

export function StationForm({
  projectId,
  station,
  siguiente,
}: {
  projectId: string;
  station?: AirStation;
  /** Número sugerido para una estación nueva. */
  siguiente?: number;
}) {
  const action = station
    ? updateStationAction.bind(null, projectId, station.id)
    : createStationAction.bind(null, projectId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);
  // Tras agregar una estación, el formulario queda limpio para la siguiente.
  useEffect(() => {
    if (state.ok && !station) form.current?.reset();
  }, [state, station]);
  const fe = state.fieldErrors ?? {};
  const v: Partial<Record<string, string>> =
    state.values ??
    (station
      ? {
          numero: String(station.numero),
          nombre: station.nombre,
          codigo: station.codigo,
          codigoAnla: station.codigoAnla,
          longitud: station.longitud,
          latitud: station.latitud,
          descripcion: station.descripcion,
        }
      : { numero: siguiente ? String(siguiente) : "" });
  const id = (k: string) => `${station?.id ?? "nueva"}-${k}`;
  return (
    <form
      ref={form}
      action={formAction}
      className="grid gap-3 sm:grid-cols-6"
    >
      {state.error && <FormError message={state.error} />}
      {state.ok && state.message && <Notice tone="success" className="sm:col-span-6">{state.message}</Notice>}
      <Field label="N.º" htmlFor={id("numero")} required error={fe.numero} hint="Hoja CA-n" className="sm:col-span-1">
        <Input id={id("numero")} name="numero" type="number" min={1} max={50} required defaultValue={v.numero} />
      </Field>
      <Field label="Nombre de la estación" htmlFor={id("nombre")} error={fe.nombre} className="sm:col-span-3"
        hint="Si se deja vacío se toma de la plantilla.">
        <Input id={id("nombre")} name="nombre" defaultValue={v.nombre} />
      </Field>
      <Field label="ID" htmlFor={id("codigo")} error={fe.codigo} hint="Ej.: E1_Lis_Tmpst" className="sm:col-span-1">
        <Input id={id("codigo")} name="codigo" defaultValue={v.codigo} />
      </Field>
      <Field label="ID ANLA" htmlFor={id("codigoAnla")} error={fe.codigoAnla} className="sm:col-span-1">
        <Input id={id("codigoAnla")} name="codigoAnla" defaultValue={v.codigoAnla} />
      </Field>
      <Field label="Longitud / Este" htmlFor={id("longitud")} error={fe.longitud} className="sm:col-span-3"
        hint={`Grados (73°33'40.40"O o -73.5612) o Este del Origen Nacional.`}>
        <Input id={id("longitud")} name="longitud" defaultValue={v.longitud} />
      </Field>
      <Field label="Latitud / Norte" htmlFor={id("latitud")} error={fe.latitud} className="sm:col-span-3">
        <Input id={id("latitud")} name="latitud" defaultValue={v.latitud} />
      </Field>
      <Field label="Descripción" htmlFor={id("descripcion")} error={fe.descripcion} className="sm:col-span-6">
        <Textarea id={id("descripcion")} name="descripcion" rows={2} defaultValue={v.descripcion} />
      </Field>
      <div className="sm:col-span-6">
        <SubmitButton size="sm">{station ? "Guardar estación" : "Agregar estación"}</SubmitButton>
      </div>
    </form>
  );
}
