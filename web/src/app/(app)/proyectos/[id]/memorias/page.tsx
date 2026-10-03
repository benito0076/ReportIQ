import type { Metadata } from "next";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { removeMemoryAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/notice";
import { UploadButton } from "@/components/upload";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIRECCIONES, ESQUEMAS, ESQUEMA_LABELS } from "@/db/enums";
import { formatBytes } from "@/lib/files";
import { getProject, listBarrido, listMemoryFiles, listPoints } from "@/server/projects";
import { BulkUpload } from "./bulk-upload";
import { EmisionMemorias } from "./emision-memorias";

export const metadata: Metadata = { title: "Memorias del sonómetro" };

export default async function MemoriesPage({ params }: PageProps<"/proyectos/[id]/memorias">) {
  const { id } = await params;
  const [project, pts, files, barrido] = await Promise.all([
    getProject(id),
    listPoints(id),
    listMemoryFiles(id),
    listBarrido(id),
  ]);

  if (pts.length === 0) {
    return (
      <Notice tone="info" title="Primero agregue los puntos de monitoreo">
        <Link href={`/proyectos/${id}`} className="underline">
          Ir a Proyecto y puntos
        </Link>
      </Notice>
    );
  }

  if (project.tipo === "emision") {
    return <EmisionMemorias projectId={id} points={pts} files={files} barrido={barrido} />;
  }

  return (
    <div className="grid gap-6">
      <Notice tone="info">
        Exporte cada punto y dirección desde el software del sonómetro como <strong>.xlsx</strong> (hojas «Resumen» y
        «OBA») y asígnelos aquí para cada jornada medida. Con <strong>«Subir las 5»</strong> puede elegir varios
        archivos a la vez: la dirección se reconoce por el nombre del archivo (p. ej. <code>RA1_Norte.xlsx</code>).
      </Notice>
      {pts.map((p) => {
        const mine = files.filter((f) => f.pointId === p.id);
        return (
          <Card key={p.id}>
            <CardHeader className="border-b">
              <CardTitle>
                Punto {p.orden}: {p.nombre}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{mine.length} de 20 memorias</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="w-24 py-2 font-medium">Dirección</th>
                    {ESQUEMAS.map((e) => (
                      <th key={e} className="px-1 py-2 align-top font-medium">
                        <div>{ESQUEMA_LABELS[e]}</div>
                        <BulkUpload projectId={id} pointId={p.id} esquema={e} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIRECCIONES.map((d) => (
                    <tr key={d} className="border-t">
                      <td className="py-2 font-medium">{d}</td>
                      {ESQUEMAS.map((e) => {
                        const f = mine.find((m) => m.esquema === e && m.direccion === d);
                        const target = { kind: "memoria" as const, projectId: id, pointId: p.id, esquema: e, direccion: d };
                        return (
                          <td key={e} className="px-1 py-1.5 align-middle">
                            {f ? (
                              <div className="flex items-center gap-1 rounded-md bg-exito-suave px-2 py-1 ring-1 ring-emerald-200">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-medium" title={f.fileName}>
                                    {f.fileName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</div>
                                </div>
                                <a
                                  href={`/api/proyectos/${id}/memorias/${f.id}`}
                                  className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
                                  title="Descargar"
                                  aria-label="Descargar"
                                >
                                  <Download />
                                </a>
                                <ConfirmButton
                                  action={removeMemoryAction.bind(null, id, f.id)}
                                  confirm={`¿Quitar "${f.fileName}"?`}
                                  size="icon-sm"
                                  title="Quitar"
                                >
                                  <Trash2 className="text-peligro" />
                                </ConfirmButton>
                              </div>
                            ) : (
                              <UploadButton target={target} label="Subir" size="xs" variant="ghost" className="text-muted-foreground" />
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
        <Link href={`/proyectos/${id}/resultados`} className={buttonVariants()}>
          Siguiente: procesar →
        </Link>
      </div>
    </div>
  );
}
