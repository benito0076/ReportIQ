import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Clock, FileText, FolderOpen, Undo2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NuevoProyecto } from "@/components/nuevo-proyecto";
import { MATRIZ_UI, MatrizIcono } from "@/components/matriz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { puedeAprobar, REPORT_LABELS } from "@/db/enums";
import { contarPendientes, listDevueltos } from "@/server/aprobaciones";
import { formatDate, formatDateTime } from "@/lib/format";
import { MATRICES } from "@/lib/matrices";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listAllProjects, recentReports, type ProyectoListado } from "@/server/projects";

export const metadata: Metadata = { title: "Inicio" };

const DIA = 24 * 60 * 60 * 1000;

function Indicador({ titulo, valor, detalle, href }: { titulo: string; valor: number; detalle: string; href: string }) {
  return (
    <Link href={href} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:bg-muted/40">
        <CardContent className="grid gap-1">
          <span className="text-sm text-muted-foreground">{titulo}</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{valor}</span>
          <span className="text-xs text-muted-foreground">{detalle}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function estado(p: ProyectoListado) {
  if (p.ultimoInforme) return { texto: `Informe ${formatDate(p.ultimoInforme)}`, clase: "bg-exito-suave text-exito-texto" };
  if (p.procesadoAt) return { texto: "Procesado", clase: "bg-secondary text-secondary-foreground" };
  return { texto: "En preparación", clase: "bg-aviso-suave text-aviso-texto" };
}

export default async function InicioPage() {
  const user = await requireUser();
  const ahora = new Date();
  const [proyectos, informes, pendientes, devueltos] = await Promise.all([
    listAllProjects(),
    recentReports(new Date(ahora.getTime() - 7 * DIA)),
    puedeAprobar(user.role) ? contarPendientes() : 0,
    listDevueltos(user.id),
  ]);
  const matrices = MATRICES;
  const enPreparacion = proyectos.filter((p) => !p.procesadoAt && !p.ultimoInforme);
  const recientes = proyectos.slice(0, 6);
  // Primer nombre, sin títulos como «Ing.» o «Dr.».
  const nombre = (user.fullName ?? user.email).split(/[ @]/).find((w) => w && !w.endsWith(".")) ?? user.email;
  // El servidor corre en UTC: la hora y la fecha se muestran en la de Colombia.
  const hora = Number(new Intl.DateTimeFormat("es-CO", { hour: "numeric", hourCycle: "h23", timeZone: "America/Bogota" }).format(ahora));
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {saludo}, {nombre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }).format(ahora)}
          </p>
        </div>
        <NuevoProyecto />
      </div>

      {(pendientes > 0 || devueltos.length > 0) && (
        <div className="grid gap-2">
          {pendientes > 0 && (
            <Link
              href="/aprobaciones"
              className="flex items-center gap-2 rounded-lg border border-info-borde bg-info-suave px-3 py-2 text-sm text-info-texto hover:brightness-95"
            >
              <ClipboardCheck className="size-4 shrink-0" />
              <span>
                <span className="font-medium">
                  {pendientes} informe{pendientes === 1 ? "" : "s"} por aprobar.
                </span>{" "}
                Revíselos en la bandeja de aprobación.
              </span>
              <ArrowRight className="ml-auto size-4" />
            </Link>
          )}
          {devueltos.map((d) => (
            <Link
              key={d.id}
              href={d.href}
              className="flex items-start gap-2 rounded-lg border border-aviso-borde bg-aviso-suave px-3 py-2 text-sm text-aviso-texto hover:brightness-95"
            >
              <Undo2 className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="font-medium">Informe devuelto: {d.nombre}.</span>{" "}
                {d.revisor ?? "El aprobador"} pide: «{d.observaciones}»
              </span>
              <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Proyectos" valor={proyectos.length} detalle="En todas las matrices" href="/proyectos" />
        <Indicador
          titulo="En preparación"
          valor={enPreparacion.length}
          detalle="Aún sin procesar ni informe"
          href="/proyectos"
        />
        <Indicador
          titulo="Informes esta semana"
          valor={informes.length}
          detalle="Word, Excel y anexos generados"
          href="/proyectos?orden=informe"
        />
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Matrices</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {matrices.map((m) => {
            const ui = MATRIZ_UI[m.clave];
            const n = proyectos.filter((p) => p.matriz === m.clave).length;
            return (
              <Link
                key={m.clave}
                href={m.href}
                className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className={cn("h-full border-t-4 transition-colors group-hover:bg-muted/40", ui.borde)}>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <MatrizIcono matriz={m.clave} size="lg" />
                    </div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {m.titulo}
                      <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </CardTitle>
                    <CardDescription>{m.descripcion}</CardDescription>
                    <p className="pt-1 text-xs text-muted-foreground">
                      {n} proyecto{n === 1 ? "" : "s"}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" /> Continuar trabajando
            </CardTitle>
            <CardDescription>Proyectos modificados recientemente.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {recientes.length === 0 ? (
              <EmptyState icono={FolderOpen} titulo="Aún no hay proyectos" accion={{ href: "/proyectos", texto: "Crear el primero" }} />
            ) : (
              <ul className="divide-y">
                {recientes.map((p) => {
                  const e = estado(p);
                  return (
                    <li key={p.id}>
                      <Link href={p.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                        <MatrizIcono matriz={p.matriz} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[p.cliente, p.codigoInforme].filter(Boolean).join(" · ") || "Sin cliente"}
                          </span>
                        </span>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", e.clase)}>{e.texto}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" /> Informes de los últimos 7 días
            </CardTitle>
            <CardDescription>Entregables generados, del más reciente al más antiguo.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {informes.length === 0 ? (
              <EmptyState icono={FileText} titulo="No se han generado informes esta semana" />
            ) : (
              <ul className="divide-y">
                {informes.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <MatrizIcono matriz={r.matriz} size="sm" />
                    <span className="min-w-0 flex-1">
                      <a href={`/api/proyectos/${r.projectId}/informes/${r.id}`} className="block truncate font-medium hover:underline">
                        {r.fileName}
                      </a>
                      <Link href={r.href} className="block truncate text-xs text-muted-foreground hover:underline">
                        {r.nombre}
                      </Link>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {REPORT_LABELS[r.kind]}
                      <br />
                      {formatDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
