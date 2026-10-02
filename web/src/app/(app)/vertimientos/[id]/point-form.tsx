"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWaterPointAction, updateWaterPointAction } from "@/app/actions/vertimientos";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_AGUA, TIPO_AGUA_LABELS } from "@/db/enums";
import type { WaterPoint } from "@/db/schema";

export function PointForm({ projectId, point }: { projectId: string; point?: WaterPoint }) {
  const action = point
    ? updateWaterPointAction.bind(null, projectId, point.id)
    : createWaterPointAction.bind(null, projectId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);
  // Tras agregar un punto, el formulario queda limpio para el siguiente.
  useEffect(() => {
    if (state.ok && !point) form.current?.reset();
  }, [state, point]);
  const fe = state.fieldErrors ?? {};
  const v: Partial<Record<string, string>> =
    state.values ??
    (point
      ? {
          nombre: point.nombre,
          hojaFp: point.hojaFp,
          evaluar: point.evaluar ? "on" : "",
          tipoAgua: point.tipoAgua,
          longitud: point.longitud,
          latitud: point.latitud,
          descripcion: point.descripcion,
        }
      : { evaluar: "on", tipoAgua: "ARnD" });
  const id = (k: string) => `${point?.id ?? "nuevo"}-${k}`;
  return (
    <form ref={form} action={formAction} className="grid gap-3 sm:grid-cols-6">
      {state.error && <FormError message={state.error} />}
      {state.ok && state.message && <Notice tone="success" className="sm:col-span-6">{state.message}</Notice>}
      <Field label="Nombre del punto" htmlFor={id("nombre")} required error={fe.nombre} className="sm:col-span-3"
        hint="Como en el plan de muestreo. Ej.: Salida sistema de tratamiento">
        <Input id={id("nombre")} name="nombre" required defaultValue={v.nombre} />
      </Field>
      <Field label="Hoja de la FP-004" htmlFor={id("hojaFp")} error={fe.hojaFp} className="sm:col-span-1"
        hint="Vacío: se busca por el nombre.">
        <Input id={id("hojaFp")} name="hojaFp" defaultValue={v.hojaFp} />
      </Field>
      <Field label="Tipo de agua" htmlFor={id("tipoAgua")} error={fe.tipoAgua} className="sm:col-span-2">
        <select id={id("tipoAgua")} name="tipoAgua" className={selectClass} defaultValue={v.tipoAgua}>
          {TIPOS_AGUA.map((t) => (
            <option key={t} value={t}>
              {TIPO_AGUA_LABELS[t]}
            </option>
          ))}
        </select>
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
      <label className="flex items-start gap-2 text-sm sm:col-span-6">
        <input type="checkbox" name="evaluar" className="mt-1" defaultChecked={v.evaluar === "on"} />
        <span>
          Comparar con la norma (desmarque para la entrada al sistema de tratamiento: sus resultados se reportan sin
          declaración de conformidad).
        </span>
      </label>
      <div className="sm:col-span-6">
        <SubmitButton size="sm">{point ? "Guardar punto" : "Agregar punto"}</SubmitButton>
      </div>
    </form>
  );
}
