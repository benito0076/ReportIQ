import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Pencil, Trash2 } from "lucide-react";
import { deleteReportAction } from "@/app/actions/projects";
import {
  deleteVertProjectAction,
  deleteWaterPointAction,
  removeFp004Action,
  removeWaterPointFileAction,
} from "@/app/actions/vertimientos";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/notice";
import { UploadButton } from "@/components/upload";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatBytes } from "@/lib/files";
import { requireAdminPage } from "@/lib/session";
import { listReports } from "@/server/processing";
import { isUuid } from "@/server/projects";
import { configDe, getVertProject, listWaterPoints } from "@/server/vertimientos";
import { VertProjectForm } from "../vert-project-form";
import { NormaForm } from "./norma-form";
import { PointForm } from "./point-form";
import { VertButtons } from "./vert-buttons";
import { VertResultados } from "./vert-results";

export const metadata: Metadata = { title: "Vertimientos" };

export default async function VertProjectPage({ params }: PageProps<"/vertimientos/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const project = await getVertProject(id).catch(() => null);
  if (!project) notFound();
  const [puntos, reps] = await Promise.all([listWaterPoints(id), listReports(id)]);
  const r = project.resultadosVertimiento;
  const config = configDe(project);
  const conReporte = puntos.some((p) => p.informeKey);

  return (
    <>
      <Link href="/vertimientos" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Vertimientos
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {["Vertimientos", project.codigoInforme, project.cliente].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge variant="outline">En desarrollo · solo administrador</Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Datos del proyecto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <VertProjectForm project={project} />
            <div className="border-t pt-3">
              <ConfirmButton
                action={deleteVertProjectAction.bind(null, id)}
                confirm="¿Eliminar el proyecto con sus puntos, reportes e informes? No se puede deshacer."
                variant="outline"
              >
                <Trash2 className="text-red-600" /> Eliminar proyecto
              </ConfirmButton>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>2. Norma aplicable</CardTitle>
            <CardDescription>
              Resolución 0631 de 2015. Cada actividad seleccionada es una columna de límites en la tabla de resultados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NormaForm projectId={id} config={config} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>3. Puntos de muestreo</CardTitle>
            <CardDescription>
              Por cada punto suba la copia en PDF del reporte de resultados del laboratorio (FT-024): la app lee los
              ensayos, el método, el LCM, el resultado y la incertidumbre.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-0">
            {puntos.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Punto</TableHead>
                    <TableHead>Reporte del laboratorio</TableHead>
                    <TableHead>Foto</TableHead>
                    <TableHead className="pr-4 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puntos.map((p) => (
                    <TableRow key={p.id} className="align-top">
                      <TableCell className="pl-4 whitespace-normal">
                        <div className="font-medium">{p.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            p.tipoAgua,
                            p.evaluar ? "Se compara con la norma" : "Sin comparación",
                            p.hojaFp && `Hoja FP-004: ${p.hojaFp}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        <details className="mt-1">
                          <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                            <Pencil className="size-3" /> Editar
                          </summary>
                          <div className="mt-2 rounded-lg border p-3">
                            <PointForm projectId={id} point={p} />
                          </div>
                        </details>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {p.informeKey ? (
                          <a
                            href={`/api/vertimientos/${id}/puntos/${p.id}/informe`}
                            className="text-sm hover:underline"
                          >
                            {p.informeNombre}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin reporte</span>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          <UploadButton
                            target={{ kind: "laboratorio", projectId: id, pointId: p.id }}
                            label={p.informeKey ? "Reemplazar" : "Subir PDF"}
                          />
                          {p.informeKey && (
                            <ConfirmButton
                              action={removeWaterPointFileAction.bind(null, id, p.id, "informe")}
                              confirm={`¿Quitar el reporte del punto «${p.nombre}»?`}
                              size="icon-sm"
                              variant="ghost"
                              title="Quitar reporte"
                            >
                              <Trash2 className="text-red-600" />
                            </ConfirmButton>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {p.fotoKey && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/vertimientos/${id}/puntos/${p.id}/foto?v=${encodeURIComponent(p.fotoKey)}`}
                              alt={`Foto del punto ${p.nombre}`}
                              className="h-16 w-24 rounded border object-cover"
                            />
                          )}
                          <div className="flex items-center gap-1">
                            <UploadButton
                              target={{ kind: "fotoAgua", projectId: id, pointId: p.id }}
                              label={p.fotoKey ? "Cambiar" : "Subir foto"}
                            />
                            {p.fotoKey && (
                              <ConfirmButton
                                action={removeWaterPointFileAction.bind(null, id, p.id, "foto")}
                                confirm={`¿Quitar la foto del punto «${p.nombre}»?`}
                                size="icon-sm"
                                variant="ghost"
                                title="Quitar foto"
                              >
                                <Trash2 className="text-red-600" />
                              </ConfirmButton>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <ConfirmButton
                          action={deleteWaterPointAction.bind(null, id, p.id)}
                          confirm={`¿Eliminar el punto «${p.nombre}» con su reporte?`}
                          size="icon-sm"
                          title="Eliminar"
                        >
                          <Trash2 className="text-red-600" />
                        </ConfirmButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="px-4">
              <div className="rounded-lg border">
                <h3 className="border-b px-3 py-2 text-sm font-medium">Agregar punto</h3>
                <div className="p-3">
                  <PointForm projectId={id} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>4. Datos de campo (FP-004)</CardTitle>
            <CardDescription>
              Plantilla de datos de vertimientos con una hoja por punto: aforo volumétrico, pH, temperatura, oxígeno
              disuelto, conductividad y sólidos sedimentables. La app calcula caudales y alícuotas. Es opcional.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            {project.fp004Key ? (
              <a href={`/api/vertimientos/${id}/fp004`} className="text-sm hover:underline">
                {project.fp004Nombre}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Sin archivo</span>
            )}
            <div className="inline-flex gap-1">
              <UploadButton target={{ kind: "fp004", projectId: id }} label={project.fp004Key ? "Reemplazar" : "Subir"} />
              {project.fp004Key && (
                <ConfirmButton
                  action={removeFp004Action.bind(null, id)}
                  confirm="¿Quitar la FP-004?"
                  size="icon-sm"
                  title="Quitar"
                >
                  <Trash2 className="text-red-600" />
                </ConfirmButton>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>5. Procesamiento y entregables</CardTitle>
            <CardDescription>
              Compara los resultados del laboratorio con los límites de la Resolución 0631 de 2015. El informe Word llegará
              en la siguiente fase; por ahora se genera el Excel de resultados.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!conReporte ? (
              <Notice tone="info">Agregue los puntos y suba al menos un reporte del laboratorio para procesar el proyecto.</Notice>
            ) : r && project.procesadoAt ? (
              <p className="text-sm text-muted-foreground">Procesado: {formatDateTime(project.procesadoAt)}</p>
            ) : (
              <Notice tone="warning">
                {reps.length > 0
                  ? "Los datos cambiaron desde el último procesamiento: vuelva a procesar para ver los resultados actualizados."
                  : "El proyecto aún no se ha procesado."}
              </Notice>
            )}
            <VertButtons projectId={id} disabled={!conReporte} />
            {reps.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Generado</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reps.map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{rep.fileName}</div>
                        {rep.advertencias.length > 0 && (
                          <details className="text-xs text-amber-800">
                            <summary className="cursor-pointer">{rep.advertencias.length} advertencia(s)</summary>
                            <ul className="list-disc pl-4">
                              {rep.advertencias.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(rep.createdAt)}</TableCell>
                      <TableCell>{formatBytes(rep.size)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <a
                            href={`/api/proyectos/${id}/informes/${rep.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <Download /> Descargar
                          </a>
                          <ConfirmButton
                            action={deleteReportAction.bind(null, id, rep.id)}
                            confirm="¿Eliminar este archivo del historial?"
                            size="icon-sm"
                            title="Eliminar"
                          >
                            <Trash2 className="text-red-600" />
                          </ConfirmButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {r && (
          <>
            {r.advertencias.length > 0 && (
              <Notice tone="warning" title={`Advertencias (${r.advertencias.length})`}>
                <ul className="list-disc pl-4">
                  {r.advertencias.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <VertResultados r={r} />
          </>
        )}
      </div>
    </>
  );
}
