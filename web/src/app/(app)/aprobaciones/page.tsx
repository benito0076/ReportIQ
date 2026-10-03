import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MatrizIcono } from "@/components/matriz";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { puedeAprobar } from "@/db/enums";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listPendientes } from "@/server/aprobaciones";
import { matrizDe } from "@/server/projects";

export const metadata: Metadata = { title: "Por aprobar" };

export default async function AprobacionesPage() {
  const user = await requireUser();
  if (!puedeAprobar(user.role)) redirect("/inicio");
  const pendientes = await listPendientes();
  return (
    <>
      <PageHeader
        title="Informes por aprobar"
        description="Informes Word enviados a revisión. Al aprobar, «Autorizó» se firma con su nombre y cargo (Mi perfil) y queda la versión final; al devolver, el técnico ve sus observaciones."
      />
      <Card>
        <CardContent className="px-0">
          {pendientes.length === 0 ? (
            <EmptyState icono={ClipboardCheck} titulo="No hay informes pendientes" texto="Cuando un técnico envíe un informe a revisión aparecerá aquí." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Informe</TableHead>
                  <TableHead>Elaboró</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead className="pr-4 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 whitespace-normal">
                      <div className="flex items-center gap-2.5">
                        <MatrizIcono matriz={matrizDe(p.tipo)} size="sm" />
                        <div>
                          <div className="font-medium">{p.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {[p.nombre, p.cliente, p.codigo].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {p.autor ?? p.autorEmail ?? "—"}
                      {p.createdBy === user.id && <div className="text-xs text-muted-foreground">Usted (no puede aprobarlo)</div>}
                    </TableCell>
                    <TableCell>{formatDateTime(p.enviadoAt)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link href={p.href} className={buttonVariants({ size: "sm" })}>
                        Revisar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
