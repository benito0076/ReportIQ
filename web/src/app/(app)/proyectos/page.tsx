import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderOpen, Search, SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MatrizIcono } from "@/components/matriz";
import { PageHeader } from "@/components/page-header";
import { selectClass } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROJECT_TYPE_LABELS } from "@/db/enums";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listAllProjects, type ProyectoListado } from "@/server/projects";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Proyectos" };

const MATRICES = [
  { clave: "ruido", titulo: "Ruido", unidad: "puntos" },
  { clave: "aire", titulo: "Calidad del aire", unidad: "estaciones" },
  { clave: "vertimientos", titulo: "Vertimientos", unidad: "puntos" },
] as const;

const ORDENES = {
  actualizado: "Última actualización",
  nombre: "Nombre",
  cliente: "Cliente",
  informe: "Último informe",
} as const;
type Orden = keyof typeof ORDENES;

function texto(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function ordenar(lista: ProyectoListado[], orden: Orden): ProyectoListado[] {
  const fecha = (d: Date | string | null) => (d ? new Date(d).getTime() : 0);
  const copia = [...lista];
  if (orden === "nombre") copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  else if (orden === "cliente") copia.sort((a, b) => a.cliente.localeCompare(b.cliente, "es") || a.nombre.localeCompare(b.nombre, "es"));
  else if (orden === "informe") copia.sort((a, b) => fecha(b.ultimoInforme) - fecha(a.ultimoInforme));
  return copia; // "actualizado": ya viene ordenado por la consulta
}

function Estado({ p }: { p: ProyectoListado }) {
  if (p.ultimoInforme) {
    return (
      <Badge variant="secondary" className="bg-exito-suave text-exito-texto">
        Informe {formatDate(p.ultimoInforme)}
      </Badge>
    );
  }
  if (p.procesadoAt) return <Badge variant="secondary">Procesado</Badge>;
  return <Badge variant="outline">En preparación</Badge>;
}

export default async function ProjectsPage({ searchParams }: PageProps<"/proyectos">) {
  await requireUser();
  const sp = await searchParams;
  const matrices = MATRICES;
  const matriz = matrices.some((m) => m.clave === texto(sp.matriz)) ? texto(sp.matriz) : "";
  const q = texto(sp.q);
  const orden: Orden = texto(sp.orden) in ORDENES ? (texto(sp.orden) as Orden) : "actualizado";

  const todos = await listAllProjects();
  const busqueda = sinTildes(q);
  const filtrados = ordenar(
    todos.filter(
      (p) =>
        (!matriz || p.matriz === matriz) &&
        (!busqueda || sinTildes(`${p.nombre} ${p.cliente} ${p.codigoInforme}`).includes(busqueda)),
    ),
    orden,
  );
  const cuenta = (m: string) => todos.filter((p) => !m || p.matriz === m).length;
  const enlace = (m: string) => {
    const params = new URLSearchParams();
    if (m) params.set("matriz", m);
    if (q) params.set("q", q);
    if (orden !== "actualizado") params.set("orden", orden);
    const s = params.toString();
    return s ? `/proyectos?${s}` : "/proyectos";
  };

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Todos los proyectos: ruido, calidad del aire y vertimientos."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 gap-4 self-start">
          {matrices.length > 1 && (
            <nav className="flex flex-wrap gap-2" aria-label="Filtrar por matriz">
              {[{ clave: "", titulo: "Todas" }, ...matrices].map((m) => (
                <Link
                  key={m.clave || "todas"}
                  href={enlace(m.clave)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    matriz === m.clave ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {m.clave && <span className={cn("mr-1.5 inline-block size-2 rounded-full", { ruido: "bg-ruido", aire: "bg-aire", vertimientos: "bg-agua" }[m.clave])} />}
                  {m.titulo} <span className="opacity-70">({cuenta(m.clave)})</span>
                </Link>
              ))}
            </nav>
          )}
          <form className="flex flex-wrap items-center gap-2" action="/proyectos">
            {matriz && <input type="hidden" name="matriz" value={matriz} />}
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Buscar por nombre, cliente o código" className="pl-8" />
            </div>
            <select name="orden" defaultValue={orden} className={cn(selectClass, "w-auto")} aria-label="Ordenar por">
              {Object.entries(ORDENES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
            {(q || orden !== "actualizado") && (
              <Link href={matriz ? `/proyectos?matriz=${matriz}` : "/proyectos"} className="text-sm text-muted-foreground hover:underline">
                Limpiar
              </Link>
            )}
          </form>
          <Card>
            <CardContent className="px-0">
              {filtrados.length === 0 ? (
                todos.length === 0 ? (
                  <EmptyState icono={FolderOpen} titulo="Aún no hay proyectos" texto="Cree el primero con el formulario de la derecha." />
                ) : (
                  <EmptyState
                    icono={SearchX}
                    titulo="Ningún proyecto coincide con el filtro"
                    accion={{ href: "/proyectos", texto: "Ver todos los proyectos" }}
                  />
                )
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
                    {filtrados.map((p) => {
                      const m = MATRICES.find((x) => x.clave === p.matriz)!;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2.5">
                              <MatrizIcono matriz={p.matriz} size="sm" />
                              <div>
                                <Link href={p.href} className="font-medium hover:underline">
                                  {p.nombre}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {[PROJECT_TYPE_LABELS[p.tipo], p.codigoInforme].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-36 truncate" title={p.cliente}>{p.cliente}</TableCell>
                          <TableCell className="text-center" title={m.unidad}>
                            {p.elementos}
                          </TableCell>
                          <TableCell>
                            <Estado p={p} />
                          </TableCell>
                          <TableCell className="pr-4 text-muted-foreground">{formatDate(p.updatedAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo proyecto de ruido</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Otras matrices</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Link href="/aire" className="inline-flex items-center gap-2 hover:underline">
                <MatrizIcono matriz="aire" size="sm" /> Nuevo proyecto de calidad del aire <ArrowRight className="size-3" />
              </Link>
              <Link href="/vertimientos" className="inline-flex items-center gap-2 hover:underline">
                <MatrizIcono matriz="vertimientos" size="sm" /> Nuevo proyecto de vertimientos <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
