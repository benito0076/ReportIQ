"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPointAction, updatePointAction } from "@/app/actions/projects";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectType } from "@/db/enums";
import type { Point } from "@/db/schema";
import { SECTORES } from "@/lib/validation";

export function PointForm({
  projectId,
  point,
  tipo = "ambiental",
}: {
  projectId: string;
  point?: Point;
  tipo?: ProjectType;
}) {
  const action = point ? updatePointAction.bind(null, projectId, point.id) : createPointAction.bind(null, projectId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const v: Record<string, string> = state.values ?? {
    nombre: point?.nombre ?? "",
    sector: point?.sector ?? "",
    incertidumbre: point ? String(point.incertidumbre).replace(".", ",") : "0,0043",
    este: point?.este ?? "",
    norte: point?.norte ?? "",
    altitud: point?.altitud ?? "",
    descripcion: point?.descripcion ?? "",
    fuentes: point?.fuentes ?? "",
  };
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.error && (
        <div className="sm:col-span-2">
          <FormError message={state.error} />
        </div>
      )}
      <Field label="Nombre del punto" htmlFor="nombre" required error={fe.nombre} hint="Ej.: RA1">
        <Input id="nombre" name="nombre" required defaultValue={v.nombre} />
      </Field>
      <Field label="Incertidumbre de la técnica (± dB)" htmlFor="incertidumbre" error={fe.incertidumbre}>
        <Input id="incertidumbre" name="incertidumbre" inputMode="decimal" defaultValue={v.incertidumbre} />
      </Field>
      <Field
        label={tipo === "emision" ? "Sector (Res. 0627, Art. 9 – emisión)" : "Sector (Res. 0627, Art. 17 – ambiental)"}
        htmlFor="sector" error={fe.sector} className="sm:col-span-2">
        <select id="sector" name="sector" defaultValue={v.sector} className={selectClass}>
          <option value="">— Sin asignar (no se compara con la norma) —</option>
          {SECTORES.map((s) => (
            <option key={s.etiqueta} value={s.etiqueta}>
              {tipo === "emision" ? `${s.emisionDia}/${s.emisionNoche}` : `${s.dia}/${s.noche}`} dB(A) · {s.etiqueta}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Coordenada Este / Longitud"
        htmlFor="este"
        error={fe.este}
        hint="Origen Nacional (m), recomendado; o longitud en grados decimales."
      >
        <Input id="este" name="este" inputMode="decimal" defaultValue={v.este} placeholder="4919855,125" />
      </Field>
      <Field label="Coordenada Norte / Latitud" htmlFor="norte" error={fe.norte}>
        <Input id="norte" name="norte" inputMode="decimal" defaultValue={v.norte} placeholder="2309786,167" />
      </Field>
      <Field label="Altitud (m.s.n.m., opcional)" htmlFor="altitud" error={fe.altitud}>
        <Input id="altitud" name="altitud" defaultValue={v.altitud} />
      </Field>
      <Field label="Descripción del punto" htmlFor="descripcion" error={fe.descripcion} className="sm:col-span-2">
        <Textarea id="descripcion" name="descripcion" rows={6} defaultValue={v.descripcion} />
      </Field>
      <Field
        label="Fuentes de ruido percibidas"
        htmlFor="fuentes"
        error={fe.fuentes}
        className="sm:col-span-2"
        hint="Para el capítulo «Descripción de las fuentes generadoras de ruido» y las conclusiones. Ej.: Se percibieron aves, grillos y el tránsito ocasional de motocicletas por la vía destapada."
      >
        <Textarea id="fuentes" name="fuentes" rows={4} defaultValue={v.fuentes} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton>{point ? "Guardar punto" : "Crear punto"}</SubmitButton>
        <Link href={`/proyectos/${projectId}`} className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
