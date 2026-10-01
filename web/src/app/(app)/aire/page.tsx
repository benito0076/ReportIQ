import type { Metadata } from "next";
import Link from "next/link";
import { Wind } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireAdminPage } from "@/lib/session";
import { listAireProjects } from "@/server/aire";
import { AireProjectForm } from "./aire-project-form";

export const metadata: Metadata = { title: "Calidad del aire" };

/** Matriz en desarrollo: solo el administrador puede entrar. */
export default async function AirePage() {
  await requireAdminPage();
  const projects = await listAireProjects();
  return (
    <>
      <PageHeader
        title="Calidad del aire"
        description="Monitoreos de calidad del aire según la Resolución 2254 de 2017 (un proyecto por plan de muestreo)."
      >
        <Badge variant="outline">En desarrollo · solo administrador</Badge>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="px-0">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
                <Wind className="size-8" />
                <p>Aún no hay proyectos de calidad del aire. Cree el primero con el formulario.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Proyecto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Estaciones</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-4">Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <Link href={`/aire/${p.id}`} className="font-medium hover:underline">
                          {p.nombre}
                        </Link>
                        {p.codigoInforme && <div className="text-xs text-muted-foreground">{p.codigoInforme}</div>}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{p.cliente}</TableCell>
                      <TableCell className="text-center">{p.estaciones ?? 0}</TableCell>
                      <TableCell>
                        {p.procesadoAt ? <Badge variant="secondary">Procesado</Badge> : <Badge variant="outline">En preparación</Badge>}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">{formatDate(p.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Nuevo proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <AireProjectForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
