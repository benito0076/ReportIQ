import type { Metadata } from "next";
import Link from "next/link";
import { Droplets } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listVertProjects } from "@/server/vertimientos";
import { VertProjectForm } from "./vert-project-form";

export const metadata: Metadata = { title: "Vertimientos" };

export default async function VertimientosPage() {
  await requireUser();
  const projects = await listVertProjects();
  return (
    <>
      <PageHeader
        title="Vertimientos"
        description="Caracterización de vertimientos frente a la Resolución 0631 de 2015 (un proyecto por plan de muestreo)."
      >
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="px-0">
            {projects.length === 0 ? (
              <EmptyState icono={Droplets} titulo="Aún no hay proyectos" texto="Cree el primero con el formulario de la derecha." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Proyecto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Puntos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-4">Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <Link href={`/vertimientos/${p.id}`} className="font-medium hover:underline">
                          {p.nombre}
                        </Link>
                        {p.codigoInforme && <div className="text-xs text-muted-foreground">{p.codigoInforme}</div>}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{p.cliente}</TableCell>
                      <TableCell className="text-center">{p.puntos ?? 0}</TableCell>
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
            <VertProjectForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
