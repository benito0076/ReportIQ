import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Pencil, Trash2 } from "lucide-react";
import {
  deleteAireProjectAction,
  deleteStationAction,
  removeAirFileAction,
  removeStationPhotoAction,
} from "@/app/actions/aire";
import { deleteReportAction, removeMeteoAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/notice";
import { AbrirAncla } from "@/components/abrir-ancla";
import { MatrizIcono } from "@/components/matriz";
import { PasoCard } from "@/components/paso";
import { ListaVerificacion, ProgresoPasos } from "@/components/progreso";
import { UploadButton } from "@/components/upload";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLANTILLAS_AIRE, PLANTILLA_AIRE_LABELS } from "@/db/enums";
import { formatBytes } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { revisarAire } from "@/lib/progreso";
import { requireAdminPage } from "@/lib/session";
import { getAireProject, listAirFiles, listStations } from "@/server/aire";
import { listReports } from "@/server/processing";
import { getSettings } from "@/server/settings";
import { isUuid } from "@/server/projects";
import { InformeForm } from "../../proyectos/[id]/informe-form";
import { AireProjectForm } from "../aire-project-form";
import { AireButtons } from "./aire-buttons";
import { AireResultados } from "./aire-results";
import { StationForm } from "./station-form";

export const metadata: Metadata = { title: "Calidad del aire" };

export default async function AireProjectPage({ params }: PageProps<"/aire/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const project = await getAireProject(id).catch(() => null);
  if (!project) notFound();
  const [estaciones, archivos, reps, settings] = await Promise.all([
    listStations(id),
    listAirFiles(id),
    listReports(id),
    getSettings(),
  ]);
  const r = project.resultadosAire;
  const revision = revisarAire({
    cliente: project.cliente,
    codigo: project.codigoInforme,
    estaciones,
    plantillas: archivos.length,
    meteo: !!project.meteoKey,
    informe: project.informe,
    procesado: !!(r && project.procesadoAt),
    firmas: settings,
  });
  const siguiente = Math.max(0, ...estaciones.map((e) => e.numero)) + 1;

  const paso = (ancla: string) => revision.pasos.find((p) => p.ancla === ancla);
  return (
    <>
      <Link href="/aire" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Calidad del aire
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <MatrizIcono matriz="aire" size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {["Calidad del aire", project.codigoInforme, project.cliente].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <Badge variant="outline">En desarrollo · solo administrador</Badge>
      </div>

      <div className="grid gap-6">
        <ProgresoPasos pasos={revision.pasos} />
        <AbrirAncla />
        <PasoCard id="paso-datos" numero={1} titulo="Datos del proyecto" paso={paso("paso-datos")} resumen={[project.cliente, project.codigoInforme].filter(Boolean).join(" · ")}>
          <div className="grid gap-4">
              <AireProjectForm project={project} />
              <div className="border-t pt-3">
                <ConfirmButton
                  action={deleteAireProjectAction.bind(null, id)}
                  confirm="¿Eliminar el proyecto con sus estaciones, plantillas e informes? No se puede deshacer."
                  variant="outline"
                >
                  <Trash2 className="text-peligro" /> Eliminar proyecto
                </ConfirmButton>
              </div>
          </div>
        </PasoCard>

        <PasoCard id="paso-estaciones" numero={2} titulo="Estaciones de monitoreo" paso={paso("paso-estaciones")} resumen={estaciones.map((e) => e.nombre || `Estación ${e.numero}`).join(" · ") || "Se toman de las plantillas"} descripcion={<>El número de la estación corresponde a la hoja de las plantillas (CA-1, ESTACION 1…). Si no se registran
              estaciones, se toman las de las plantillas con el nombre que traen.</>} sinMargen>
          <div className="grid gap-4">
              {estaciones.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">N.º</TableHead>
                      <TableHead>Estación</TableHead>
                      <TableHead>ID / ID ANLA</TableHead>
                      <TableHead>Coordenadas</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead className="pr-4 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estaciones.map((e) => (
                      <TableRow key={e.id} className="align-top">
                        <TableCell className="pl-4 font-medium">{e.numero}</TableCell>
                        <TableCell className="whitespace-normal">
                          {e.nombre || <span className="text-muted-foreground">(nombre de la plantilla)</span>}
                          <details className="mt-1">
                            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                              <Pencil className="size-3" /> Editar
                            </summary>
                            <div className="mt-2 rounded-lg border p-3">
                              <StationForm projectId={id} station={e} />
                            </div>
                          </details>
                        </TableCell>
                        <TableCell className="text-xs">{[e.codigo, e.codigoAnla].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell className="text-xs">{[e.latitud, e.longitud].filter(Boolean).join(" · ") || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {e.fotoKey && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/aire/${id}/estaciones/${e.id}/foto?v=${encodeURIComponent(e.fotoKey)}`}
                                alt={`Foto de la estación ${e.numero}`}
                                className="h-16 w-24 rounded border object-cover"
                              />
                            )}
                            <div className="flex items-center gap-1">
                              <UploadButton
                                target={{ kind: "fotoAire", projectId: id, stationId: e.id }}
                                label={e.fotoKey ? "Cambiar" : "Subir foto"}
                              />
                              {e.fotoKey && (
                                <ConfirmButton
                                  action={removeStationPhotoAction.bind(null, id, e.id)}
                                  confirm={`¿Quitar la foto de la estación ${e.numero}?`}
                                  size="icon-sm"
                                  variant="ghost"
                                  title="Quitar foto"
                                >
                                  <Trash2 className="text-peligro" />
                                </ConfirmButton>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <ConfirmButton
                            action={deleteStationAction.bind(null, id, e.id)}
                            confirm={`¿Eliminar la estación ${e.numero}?`}
                            size="icon-sm"
                            title="Eliminar"
                          >
                            <Trash2 className="text-peligro" />
                          </ConfirmButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="px-4">
                <div className="rounded-lg border">
                  <h3 className="border-b px-3 py-2 text-sm font-medium">Agregar estación</h3>
                  <div className="p-3">
                    <StationForm projectId={id} siguiente={siguiente} />
                  </div>
                </div>
              </div>
          </div>
        </PasoCard>

        <PasoCard id="paso-plantillas" numero={3} titulo="Plantillas de procesamiento" paso={paso("paso-plantillas")} resumen={archivos.map((a) => a.plantilla).join(" · ") || "Sin plantillas"} descripcion={<>Suba las plantillas FP diligenciadas (con los datos de campo y los pesos o resultados del laboratorio). La app
              recalcula todo con sus fórmulas.</>} sinMargen>
            <Table>
              <TableBody>
                {PLANTILLAS_AIRE.map((p) => {
                  const f = archivos.find((a) => a.plantilla === p);
                  const label = PLANTILLA_AIRE_LABELS[p];
                  return (
                    <TableRow key={p}>
                      <TableCell className="pl-4 whitespace-normal">
                        <div className="font-medium">{label.titulo}</div>
                        <div className="text-xs text-muted-foreground">{label.formato}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {f ? (
                          <>
                            <div className="text-sm">{f.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(f.size)} · {formatDateTime(f.uploadedAt)}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin archivo</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="inline-flex gap-1">
                          <UploadButton target={{ kind: "aire", projectId: id, plantilla: p }} label={f ? "Reemplazar" : "Subir"} />
                          {f && (
                            <>
                              <a
                                href={`/api/aire/${id}/plantillas/${encodeURIComponent(p)}`}
                                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                                title="Descargar"
                              >
                                <Download />
                              </a>
                              <ConfirmButton
                                action={removeAirFileAction.bind(null, id, p)}
                                confirm="¿Quitar esta plantilla?"
                                size="icon-sm"
                                title="Quitar"
                              >
                                <Trash2 className="text-peligro" />
                              </ConfirmButton>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="pl-4 whitespace-normal">
                    <div className="font-medium">Datos meteorológicos</div>
                    <div className="text-xs text-muted-foreground">Exportación de la estación (para el informe)</div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {project.meteoKey ? (
                      <span className="text-sm">{project.meteoNombre}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin archivo</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="inline-flex gap-1">
                      <UploadButton target={{ kind: "meteo", projectId: id }} label={project.meteoKey ? "Reemplazar" : "Subir"} />
                      {project.meteoKey && (
                        <>
                          <a
                            href={`/api/proyectos/${id}/meteorologia`}
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            title="Descargar"
                          >
                            <Download />
                          </a>
                          <ConfirmButton
                            action={removeMeteoAction.bind(null, id)}
                            confirm="¿Quitar los datos meteorológicos?"
                            size="icon-sm"
                            title="Quitar"
                          >
                            <Trash2 className="text-peligro" />
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
        </PasoCard>

        <PasoCard id="paso-informe" numero={4} titulo="Datos del informe" paso={paso("paso-informe")} descripcion={<>Portada, encabezado y cliente del informe Word. Las firmas del cuadro de control se toman de Ajustes.</>}>
            <InformeForm projectId={id} informe={project.informe} aire />
        </PasoCard>

        <PasoCard id="paso-procesar" numero={5} titulo="Procesamiento y entregables" paso={paso("paso-procesar")} descripcion={<>Calcula las concentraciones a condiciones de referencia, la estadística y el ICA, y las compara con la
              Resolución 2254 de 2017. El informe Word sigue el formato FP-024 (informe técnico de calidad del aire).</>} siempreAbierto>
          <div className="grid gap-4">
              {archivos.length === 0 ? (
                <Notice tone="info">Suba al menos una plantilla de procesamiento para procesar el proyecto.</Notice>
              ) : r && project.procesadoAt ? (
                <p className="text-sm text-muted-foreground">Procesado: {formatDateTime(project.procesadoAt)}</p>
              ) : (
                <Notice tone="warning">
                  {reps.length > 0
                    ? "Los datos cambiaron desde el último procesamiento: vuelva a procesar para ver los resultados actualizados."
                    : "El proyecto aún no se ha procesado."}
                </Notice>
              )}
              <ListaVerificacion avisos={revision.avisos} />
              <AireButtons projectId={id} disabled={archivos.length === 0} />
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
                            <details className="text-xs text-aviso-texto">
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
                              <Trash2 className="text-peligro" />
                            </ConfirmButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </div>
        </PasoCard>

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
            <AireResultados r={r} />
          </>
        )}
      </div>
    </>
  );
}
