"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Files, Loader2 } from "lucide-react";
import { uploadFile } from "@/components/upload";
import { Button } from "@/components/ui/button";
import type { Direccion, Esquema } from "@/db/enums";
import { detectDireccion } from "@/lib/direcciones";
import { UPLOAD_RULES } from "@/lib/files";

/** Sube varias memorias de un punto/jornada, asignando la dirección por el nombre del archivo. */
export function BulkUpload({ projectId, pointId, esquema }: { projectId: string; pointId: string; esquema: Esquema }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;

    const asignados = new Map<Direccion, File>();
    const problemas: string[] = [];
    for (const f of files) {
      const d = detectDireccion(f.name);
      if (!d) problemas.push(`"${f.name}": no se reconoce la dirección en el nombre.`);
      else if (asignados.has(d)) problemas.push(`"${f.name}": hay más de un archivo para ${d}.`);
      else asignados.set(d, f);
    }

    let hechos = 0;
    for (const [direccion, file] of asignados) {
      setStatus(`${hechos + 1}/${asignados.size}`);
      const error = await uploadFile({ kind: "memoria", projectId, pointId, esquema, direccion }, file);
      if (error) problemas.push(error);
      else hechos++;
    }
    setStatus(null);
    router.refresh();
    if (problemas.length) {
      window.alert(`Se asignaron ${hechos} archivo(s).\n\n${problemas.join("\n")}\n\nAsigne los demás con «Subir» en cada celda.`);
    }
  }

  return (
    <>
      <input ref={input} type="file" hidden multiple accept={UPLOAD_RULES.memoria.accept} onChange={onChange} />
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-1"
        disabled={status !== null}
        onClick={() => input.current?.click()}
      >
        {status ? <Loader2 className="animate-spin" /> : <Files />}
        {status ?? "Subir las 5"}
      </Button>
    </>
  );
}
