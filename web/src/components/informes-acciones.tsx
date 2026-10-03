"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send, Undo2 } from "lucide-react";
import { aprobarAction, devolverAction, enviarRevisionAction } from "@/app/actions/projects";
import type { ActionState } from "@/app/actions/state";
import { FormError, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function useAccion(accion: () => Promise<ActionState>) {
  const [pending, start] = useTransition();
  const ejecutar = (confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    start(async () => {
      const res = await accion();
      if (res?.error) window.alert(res.error);
    });
  };
  return { pending, ejecutar };
}

export function EnviarRevision({ projectId, reportId }: { projectId: string; reportId: string }) {
  const { pending, ejecutar } = useAccion(() => enviarRevisionAction(projectId, reportId));
  return (
    <Button size="sm" disabled={pending} onClick={() => ejecutar("¿Enviar este informe al aprobador?")}>
      {pending ? <Loader2 className="animate-spin" /> : <Send />} Enviar a revisión
    </Button>
  );
}

/** Aprobar (firma «Autorizó») o devolver con observaciones. */
export function RevisarInforme({ projectId, reportId }: { projectId: string; reportId: string }) {
  const aprobar = useAccion(() => aprobarAction(projectId, reportId));
  const [devolviendo, setDevolviendo] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(devolverAction.bind(null, projectId, reportId), {});
  if (devolviendo && !state.ok) {
    return (
      <form action={formAction} className="grid w-full max-w-sm gap-2 text-left">
        <FormError message={state.error} />
        <Textarea name="observaciones" required minLength={3} rows={3} placeholder="¿Qué se debe corregir?" defaultValue={state.values?.observaciones} />
        <div className="flex gap-1">
          <SubmitButton size="sm" variant="destructive">
            <Undo2 /> Devolver
          </SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDevolviendo(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }
  return (
    <>
      <Button
        size="sm"
        disabled={aprobar.pending}
        onClick={() => aprobar.ejecutar("¿Aprobar el informe? Se firmará «Autorizó» con su nombre y cargo y quedará como versión final.")}
      >
        {aprobar.pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Aprobar
      </Button>
      <Button size="sm" variant="outline" disabled={aprobar.pending} onClick={() => setDevolviendo(true)}>
        <Undo2 /> Devolver
      </Button>
    </>
  );
}
