import Link from "next/link";
import { Check, Download, Trash2 } from "lucide-react";
import { removeBarridoAction, removeMemoryAction, updateBarridoAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/notice";
import { UploadButton } from "@/components/upload";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ESQUEMAS, ESQUEMA_LABELS, RANURAS_EMISION, type RanuraEmision } from "@/db/enums";
import type { BarridoFile, Point } from "@/db/schema";
import { formatBytes } from "@/lib/files";
import { cn } from "@/lib/utils";
import { BarridoUpload } from "./barrido-upload";

type Memoria = { id: string; pointId: string; esquema: string; direccion: string; fileName: string; size: number };

const RANURA_LABEL: Record<RanuraEmision, string> = {
  Emision: "Fuente en operación",
  Residual: "Ruido residual (opcional)",
};

function Celda({ projectId, f }: { projectId: string; f: Memoria }) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 ring-1 ring-emerald-200">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium" title={f.fileName}>
          {f.fileName}
        </div>
        <div className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</div>
      </div>
      <a
        href={`/api/proyectos/${projectId}/memorias/${f.id}`}
        className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
        title="Descargar"
        aria-label="Descargar"
      >
        <Download />
      </a>
      <ConfirmButton
        action={removeMemoryAction.bind(null, projectId, f.id)}
        confirm={`¿Quitar "${f.fileName}"?`}
        size="icon-sm"
        title="Quitar"
      >
        <Trash2 className="text-red-600" />
      </ConfirmButton>
    </div>
  );
}

/** Memorias de un proyecto de emisión: por punto y jornada, la medición y el residual; y el barrido. */
export function EmisionMemorias({
  projectId,
  points,
  files,
  barrido,
}: {
  projectId: string;
  points: Point[];
  files: Memoria[];
  barrido: BarridoFile[];
}) {
  return (
    <div className="grid gap-6">
      <Notice tone="info">
        Una medición de 1 hora por punto y jornada, exportada como <strong>.xlsx</strong> (hojas «Resumen» y «OBA»).
        Si se pudo apagar la fuente, suba también la memoria del <strong>ruido residual</strong>; si no, se usa el L90
        corregido de la propia medición. Deje vacías las jornadas en que la fuente no opera.
      </Notice>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Barrido perimetral</CardTitle>
          <CardDescription>
            Memorias de 2 minutos del barrido (el nombre del archivo es el ID: «Barrido 5.xlsx»). Marque los que quedaron
            como puntos de medición: se sombrean en la tabla del informe.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {barrido.length > 0 && (
            <ul className="grid gap-1.5">
              {barrido.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                    b.seleccionado && "border-emerald-300 bg-emerald-50",
                  )}
                >
                  <span className="min-w-32 flex-1 font-medium">{b.nombre}</span>
                  <ConfirmButton
                    action={updateBarridoAction.bind(null, projectId, b.id, {
                      condicion: b.condicion === "Encendido" ? "Apagado" : "Encendido",
                    })}
                    variant="outline"
                    size="xs"
                    title="Cambiar la condición de la fuente"
                  >
                    Fuente {b.condicion.toLowerCase()}
                  </ConfirmButton>
                  <ConfirmButton
                    action={updateBarridoAction.bind(null, projectId, b.id, { seleccionado: !b.seleccionado })}
                    variant={b.seleccionado ? "default" : "outline"}
                    size="xs"
                  >
                    {b.seleccionado && <Check />} Punto de medición
                  </ConfirmButton>
                  <ConfirmButton
                    action={removeBarridoAction.bind(null, projectId, b.id)}
                    confirm={`¿Quitar "${b.nombre}"?`}
                    size="icon-sm"
                    title="Quitar"
                  >
                    <Trash2 className="text-red-600" />
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
          <div>
            <BarridoUpload projectId={projectId} />
          </div>
        </CardContent>
      </Card>

      {points.map((p) => {
        const mine = files.filter((f) => f.pointId === p.id);
        return (
          <Card key={p.id}>
            <CardHeader className="border-b">
              <CardTitle>
                P{p.orden}: {p.nombre}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{mine.length} memoria(s)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="w-44 py-2 font-medium">Jornada</th>
                    {RANURAS_EMISION.map((r) => (
                      <th key={r} className="px-1 py-2 font-medium">
                        {RANURA_LABEL[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ESQUEMAS.map((e) => (
                    <tr key={e} className="border-t">
                      <td className="py-2 font-medium">{ESQUEMA_LABELS[e]}</td>
                      {RANURAS_EMISION.map((r) => {
                        const f = mine.find((m) => m.esquema === e && m.direccion === r);
                        return (
                          <td key={r} className="px-1 py-1.5 align-middle">
                            {f ? (
                              <Celda projectId={projectId} f={f} />
                            ) : (
                              <UploadButton
                                target={{ kind: "memoria", projectId, pointId: p.id, esquema: e, direccion: r }}
                                label="Subir"
                                size="xs"
                                variant="ghost"
                                className="text-muted-foreground"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
      <div className="flex justify-end">
        <Link href={`/proyectos/${projectId}/resultados`} className={buttonVariants()}>
          Siguiente: procesar →
        </Link>
      </div>
    </div>
  );
}
