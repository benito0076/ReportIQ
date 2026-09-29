import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { deletePointAction, deleteProjectAction, movePointAction, removeMeteoAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { UploadButton } from "@/components/upload";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { SECTORES } from "@/lib/validation";
import { requireUser } from "@/lib/session";
import { getProject, listPoints } from "@/server/projects";
import { ProjectForm } from "../project-form";
import { InformeForm } from "./informe-form";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectPage({ params }: PageProps<"/proyectos/[id]">) {
  const { id } = await params;
  const [project, pts, user] = await Promise.all([getProject(id), listPoints(id), requireUser()]);
  const sectorCorto = (etiqueta: string) => {
    const s = SECTORES.find((x) => x.etiqueta === etiqueta);
    return s ? `${s.sector} · ${s.dia}/${s.noche} dB(A)` : "Sin sector";
  };
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectForm project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del informe</CardTitle>
          <CardDescription>
            Con estos datos y los resultados se redactan la portada, el encabezado, el resumen, los objetivos, la
            información del cliente, el análisis de resultados y las conclusiones del Word. Las firmas (elaboró y
            autorizó) se configuran en Ajustes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InformeForm projectId={id} informe={project.informe} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos meteorológicos</CardTitle>
          <CardDescription>
            Archivo exportado de la estación meteorológica (.xlsx con fecha/hora, temperatura, humedad, presión,
            viento y lluvia). Al generar el informe Word se usan solo los registros de los días de medición para
            completar el capítulo de meteorología: tabla, textos, gráficas y rosa de vientos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {project.meteoKey ? (
            <>
              <span className="text-sm font-medium">{project.meteoNombre}</span>
              <a href={`/api/proyectos/${id}/meteorologia`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <Download /> Descargar
              </a>
              <UploadButton target={{ kind: "meteo", projectId: id }} label="Reemplazar" />
              <ConfirmButton
                action={removeMeteoAction.bind(null, id)}
                confirm="¿Quitar el archivo de datos meteorológicos? El capítulo de meteorología quedará como en la plantilla."
                variant="ghost"
              >
                <Trash2 /> Quitar
              </ConfirmButton>
            </>
          ) : (
            <UploadButton target={{ kind: "meteo", projectId: id }} label="Subir archivo meteorológico" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Puntos de monitoreo</CardTitle>
          <CardDescription>
            {project.tipo === "emision"
              ? "El orden define el ID de cada punto en el informe (P1, P2…). Con coordenadas se genera el mapa de localización."
              : "El orden define el número de cada punto en el informe. Con al menos 3 puntos con coordenadas se generan los mapas de isófonas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {pts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay puntos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4 text-center">No.</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sector (estándar día/noche)</TableHead>
                  <TableHead>Coordenadas</TableHead>
                  <TableHead className="text-center">Incert.</TableHead>
                  <TableHead className="w-44 pr-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 text-center">{p.orden}</TableCell>
                    <TableCell>
                      <Link href={`/proyectos/${id}/puntos/${p.id}`} className="font-medium hover:underline">
                        {p.nombre}
                      </Link>
                      {p.fotoKey && <ImageIcon className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="Con foto" />}
                    </TableCell>
                    <TableCell className={p.sector ? "" : "text-amber-700"}>{sectorCorto(p.sector)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.este && p.norte ? `${p.este} / ${p.norte}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">{fmtNum(p.incertidumbre, 4)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="inline-flex gap-0.5">
                        <ConfirmButton action={movePointAction.bind(null, id, p.id, -1)} size="icon-sm" title="Subir">
                          <ArrowUp />
                        </ConfirmButton>
                        <ConfirmButton action={movePointAction.bind(null, id, p.id, 1)} size="icon-sm" title="Bajar">
                          <ArrowDown />
                        </ConfirmButton>
                        <Link
                          href={`/proyectos/${id}/puntos/${p.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <Pencil />
                        </Link>
                        <ConfirmButton
                          action={deletePointAction.bind(null, id, p.id)}
                          confirm={`¿Eliminar el punto "${p.nombre}" y sus memorias? Esta acción no se puede deshacer.`}
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <Link href={`/proyectos/${id}/puntos/nuevo`} className={buttonVariants()}>
              <Plus /> Agregar punto
            </Link>
            {pts.length > 0 && (
              <Link href={`/proyectos/${id}/memorias`} className={buttonVariants({ variant: "outline" })}>
                Siguiente: subir memorias →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {user.role === "admin" && (
        <div className="flex justify-end">
          <ConfirmButton
            action={deleteProjectAction.bind(null, id)}
            confirm="¿Eliminar este proyecto con todos sus puntos, memorias e informes? Esta acción no se puede deshacer."
            variant="destructive"
          >
            <Trash2 /> Eliminar proyecto
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
