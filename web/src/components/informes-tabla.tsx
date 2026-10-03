import { Download, Trash2 } from "lucide-react";
import { deleteReportAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { EnviarRevision, RevisarInforme } from "@/components/informes-acciones";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { puedeAprobar, REPORT_STATE_LABELS, type ReportState, type UserRole } from "@/db/enums";
import { formatBytes } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InformeDetalle } from "@/server/aprobaciones";

const ESTILO_ESTADO: Record<ReportState, string> = {
  borrador: "border-border bg-muted text-muted-foreground",
  revision: "border-info-borde bg-info-suave text-info-texto",
  aprobado: "border-exito-borde bg-exito-suave text-exito-texto",
  devuelto: "border-aviso-borde bg-aviso-suave text-aviso-texto",
};

export function EstadoInforme({ estado }: { estado: ReportState }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ESTILO_ESTADO[estado])}>
      {REPORT_STATE_LABELS[estado]}
    </Badge>
  );
}

/**
 * Historial de entregables de un proyecto. Los informes Word pasan por
 * aprobación: borrador → en revisión → aprobado (o devuelto con observaciones).
 */
export function InformesTabla({
  projectId,
  informes,
  user,
  etiqueta,
}: {
  projectId: string;
  informes: InformeDetalle[];
  user: { id: string; role: UserRole };
  etiqueta?: (kind: InformeDetalle["kind"]) => string;
}) {
  if (informes.length === 0) return null;
  const aprobador = puedeAprobar(user.role);
  return (
    <Table id="informes" className="scroll-mt-20">
      <TableHeader>
        <TableRow>
          <TableHead>Archivo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Generado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {informes.map((rep) => {
          const word = rep.kind === "word";
          const propio = rep.createdBy === user.id;
          const eliminable = user.role === "admin" || !word || rep.estado === "borrador" || rep.estado === "devuelto";
          return (
            <TableRow key={rep.id} className="align-top">
              <TableCell className="whitespace-normal">
                <div className="font-medium">{rep.estado === "aprobado" && rep.aprobadoNombre ? rep.aprobadoNombre : rep.fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {[etiqueta?.(rep.kind), formatBytes(rep.size)].filter(Boolean).join(" · ")}
                </div>
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
                {rep.estado === "devuelto" && rep.observaciones && (
                  <p className="mt-1 rounded-md border border-aviso-borde bg-aviso-suave px-2 py-1 text-xs text-aviso-texto">
                    <span className="font-medium">Observaciones de {rep.revisor ?? "el aprobador"}:</span> {rep.observaciones}
                  </p>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                {word ? (
                  <div className="grid gap-0.5">
                    <EstadoInforme estado={rep.estado} />
                    <span className="text-xs text-muted-foreground">
                      {rep.estado === "revision" && rep.enviadoAt && `Enviado ${formatDateTime(rep.enviadoAt)}`}
                      {rep.estado === "aprobado" && rep.revisadoAt && `${rep.revisor ?? ""} · ${formatDateTime(rep.revisadoAt)}`}
                      {rep.estado === "devuelto" && rep.revisadoAt && formatDateTime(rep.revisadoAt)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                <div>{formatDateTime(rep.createdAt)}</div>
                <div className="text-xs text-muted-foreground">{rep.autor ?? rep.autorEmail ?? ""}</div>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex flex-wrap justify-end gap-1">
                  {word && (rep.estado === "borrador" || rep.estado === "devuelto") && (
                    <EnviarRevision projectId={projectId} reportId={rep.id} />
                  )}
                  {word && rep.estado === "revision" && aprobador && !propio && (
                    <RevisarInforme projectId={projectId} reportId={rep.id} />
                  )}
                  <a
                    href={`/api/proyectos/${projectId}/informes/${rep.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    title={rep.estado === "aprobado" ? "Versión final, firmada" : undefined}
                  >
                    <Download /> Descargar
                  </a>
                  {eliminable && (
                    <ConfirmButton
                      action={deleteReportAction.bind(null, projectId, rep.id)}
                      confirm="¿Eliminar este archivo del historial?"
                      size="icon-sm"
                      title="Eliminar"
                    >
                      <Trash2 className="text-peligro" />
                    </ConfirmButton>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
