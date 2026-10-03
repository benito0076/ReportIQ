"use client";

import { useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

/** Crea una copia del proyecto para un nuevo monitoreo del mismo cliente. */
export function DuplicarProyecto({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      title="Copia los datos del cliente y del informe, la norma y los puntos o estaciones (con coordenadas, descripciones y fotos). No copia mediciones, reportes ni resultados."
      onClick={() => {
        if (
          !window.confirm(
            "¿Duplicar este proyecto para un nuevo monitoreo?\n\nSe copian los datos del cliente y del informe, la norma y los puntos o estaciones con sus fotos. Las mediciones, reportes del laboratorio, resultados e informes no se copian.",
          )
        ) {
          return;
        }
        start(async () => {
          const res = await duplicateProjectAction(projectId);
          if (res?.error) window.alert(res.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Copy />} Duplicar
    </Button>
  );
}
