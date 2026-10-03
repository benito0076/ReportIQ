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
import { AbrirAncla } from "@/components/abrir-ancla";
import { MatrizIcono } from "@/components/matriz";
import { PasoCard } from "@/components/paso";
import { ListaVerificacion, ProgresoPasos } from "@/components/progreso";
import { UploadButton } from "@/components/upload";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatBytes } from "@/lib/files";
import { revisarVertimiento } from "@/lib/progreso";
import ACTIVIDADES_0631 from "@/lib/res0631-actividades.json";
import { normalizarPunto } from "@/lib/puntos";
import { requireUser } from "@/lib/session";
import { listReports } from "@/server/processing";
import { firmasInforme } from "@/server/settings";
import { isUuid } from "@/server/projects";
import { configDe, getVertProject, listWaterPoints } from "@/server/vertimientos";
import { InformeForm } from "../../proyectos/[id]/informe-form";
import { VertProjectForm } from "../vert-project-form";
import { LabBulkUpload } from "./lab-bulk-upload";
import { NormaForm } from "./norma-form";
import { PointForm } from "./point-form";
import { VertButtons } from "./vert-buttons";
import { VertResultados } from "./vert-results";

export const metadata: Metadata = { title: "Vertimientos" };

export default async function VertProjectPage({ params }: PageProps<"/vertimientos/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const project = await getVertProject(id).catch(() => null);
  if (!project) notFound();
  const [puntos, reps, firmas] = await Promise.all([listWaterPoints(id), listReports(id), firmasInforme(user.id)]);
  const r = project.resultadosVertimiento;
  const config = configDe(project);
  const conReporte = puntos.some((p) => p.informeKey);
  const revision = revisarVertimiento({
    cliente: project.cliente,
    codigo: project.codigoInforme,
    actividades: config.actividades.length,
    puntos,
    fp004: !!project.fp004Key,
    informe: project.informe,
    procesado: !!(r && project.procesadoAt),
    cruzados: (r?.puntos ?? [])
      .filter((p) => p.punto_laboratorio && normalizarPunto(p.punto_laboratorio) !== normalizarPunto(p.nombre))
      .map((p) => ({ punto: p.nombre, laboratorio: p.punto_laboratorio ?? "" })),
    subcontratados: !!r?.filas.some((f) => f.subcontratado),
    firmas,
  });

  const paso = (ancla: string) => revision.pasos.find((p) => p.ancla === ancla);
  const actividades = ACTIVIDADES_0631.flatMap((g) =>
    g.actividades.filter((a) => config.actividades.includes(a.clave)).map((a) => `Art. ${g.articulo} ${a.actividad}`),
  );
  const resumenNorma =
    [actividades.join("; "), config.alcantarillado && "alcantarillado (Art. 16)"].filter(Boolean).join(" · ") ||
    "Sin actividades";
  return (
    <>
      <Link href="/vertimientos" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Vertimientos
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <MatrizIcono matriz="vertimientos" size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {["Vertimientos", project.codigoInforme, project.cliente].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <ProgresoPasos pasos={revision.pasos} />
        <AbrirAncla />
        <PasoCard id="paso-datos" numero={1} titulo="Datos del proyecto" paso={paso("paso-datos")} resumen={[project.cliente, project.codigoInforme].filter(Boolean).join(" · ")}>
          <div className="grid gap-4">
              <VertProjectForm project={project} />
              {user.role === "admin" && (
                <div className="border-t pt-3">
                  <ConfirmButton
                    action={deleteVertProjectAction.bind(null, id)}
                    confirm="¿Eliminar el proyecto con sus puntos, reportes e informes? No se puede deshacer."
                    variant="outline"
                  >
                    <Trash2 className="text-peligro" /> Eliminar proyecto
                  </ConfirmButton>
                </div>
              )}
          </div>
        </PasoCard>

        <PasoCard id="paso-norma" numero={2} titulo="Norma aplicable" paso={paso("paso-norma")} resumen={resumenNorma} descripcion={<>Resolución 0631 de 2015. Cada actividad seleccionada es una columna de límites en la tabla de resultados.</>}>
            <NormaForm projectId={id} config={config} />
        </PasoCard>

        <PasoCard id="paso-puntos" numero={3} titulo="Puntos de muestreo" paso={paso("paso-puntos")} resumen={puntos.map((p) => p.nombre).join(" · ") || "Sin puntos"} descripcion={<>Por cada punto suba la copia en PDF del reporte de resultados del laboratorio (FT-024): la app lee los
              ensayos, el método, el LCM, el resultado y la incertidumbre.</>} sinMargen>
          <div className="grid gap-4">
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
                                <Trash2 className="text-peligro" />
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
                                  <Trash2 className="text-peligro" />
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
                            <Trash2 className="text-peligro" />
                          </ConfirmButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="px-4">
                <LabBulkUpload projectId={id} />
              </div>
              <div className="px-4">
                <div className="rounded-lg border">
                  <h3 className="border-b px-3 py-2 text-sm font-medium">Agregar punto</h3>
                  <div className="p-3">
                    <PointForm projectId={id} />
                  </div>
                </div>
              </div>
          </div>
        </PasoCard>

        <PasoCard id="paso-campo" numero={4} titulo="Datos de campo (FP-004)" paso={paso("paso-campo")} resumen={project.fp004Nombre ?? "Sin archivo (opcional)"} descripcion={<>Plantilla de datos de vertimientos con una hoja por punto: aforo volumétrico, pH, temperatura, oxígeno
              disuelto, conductividad y sólidos sedimentables. La app calcula caudales y alícuotas. Es opcional.</>}>
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                    <Trash2 className="text-peligro" />
                  </ConfirmButton>
                )}
              </div>
          </div>
        </PasoCard>

        <PasoCard id="paso-informe" numero={5} titulo="Datos del informe" paso={paso("paso-informe")} descripcion={<>Portada, encabezado y cliente del informe Word. Si faltan el NIT, la dirección, el contacto o el municipio,
              se toman del reporte del laboratorio. «Elaboró» es quien genera el informe (nombre y cargo de <Link href="/perfil" className="underline">Mi perfil</Link>); «Autorizó» se toma de Ajustes.</>}>
            <InformeForm projectId={id} informe={project.informe} vertimientos />
        </PasoCard>

        <PasoCard id="paso-procesar" numero={6} titulo="Procesamiento y entregables" paso={paso("paso-procesar")} descripcion={<>Compara los resultados del laboratorio con los límites de la Resolución 0631 de 2015. El informe Word sigue
              el formato FP-023 (informe técnico de calidad de agua): tablas de campo y de laboratorio, análisis por
              parámetro con gráficas y conclusiones.</>} siempreAbierto>
          <div className="grid gap-4">
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
              <ListaVerificacion avisos={revision.avisos} />
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
            <VertResultados r={r} />
          </>
        )}
      </div>
    </>
  );
}
