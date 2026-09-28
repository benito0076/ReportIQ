import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listProjects } from "@/server/projects";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage() {
  const projects = await listProjects();
  return (
    <>
      <PageHeader title="Proyectos" description="Monitoreos de ruido ambiental según la Resolución 0627 de 2006." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="px-0">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
                <FolderOpen className="size-8" />
                <p>Aún no hay proyectos. Cree el primero con el formulario.</p>
              </div>
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
                        <Link href={`/proyectos/${p.id}`} className="font-medium hover:underline">
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
            <ProjectForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
