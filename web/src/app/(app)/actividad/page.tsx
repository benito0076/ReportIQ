import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClass } from "@/components/form";
import { Input } from "@/components/ui/input";
import { ACTIVITY_EVENTS, ACTIVITY_LABELS, type ActivityEvent } from "@/db/enums";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/lib/session";
import { cn } from "@/lib/utils";
import { activityEmails, listActivity, RETENCION_DIAS } from "@/server/activity";

export const metadata: Metadata = { title: "Actividad" };

const ALERTA: ActivityEvent[] = ["login_fallido", "proyecto_eliminado", "usuario_eliminado"];

/** Navegador y sistema resumidos a partir del user-agent. */
function dispositivo(ua: string): string {
  if (!ua) return "";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Otro";
  const so = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [nav, so].filter(Boolean).join(" · ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/actividad">) {
  await requireAdminPage();
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filtros = {
    email: uno(sp.usuario),
    event: uno(sp.evento),
    desde: uno(sp.desde),
    hasta: uno(sp.hasta),
    pagina: Number(uno(sp.pagina)) || 1,
  };
  const [{ filas, hayMas, pagina }, emails] = await Promise.all([listActivity(filtros), activityEmails()]);
  const query = (extra: Record<string, string | number>) => {
    const q = new URLSearchParams();
    const base = { usuario: filtros.email, evento: filtros.event, desde: filtros.desde, hasta: filtros.hasta };
    for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) q.set(k, String(v));
    return q.toString();
  };

  return (
    <>
      <PageHeader
        title="Actividad"
        description={`Inicios de sesión y acciones importantes de todos los usuarios. Se conservan los últimos ${RETENCION_DIAS} días.`}
      >
        <a href={`/api/actividad?${query({})}`} className={buttonVariants({ variant: "outline" })}>
          <Download /> Descargar para Excel
        </a>
      </PageHeader>

      <Card className="mb-4">
        <CardContent>
          <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <label className="grid gap-1.5 text-sm">
              Usuario
              <select name="usuario" defaultValue={filtros.email} className={selectClass}>
                <option value="">Todos</option>
                {emails.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              Evento
              <select name="evento" defaultValue={filtros.event} className={selectClass}>
                <option value="">Todos</option>
                {ACTIVITY_EVENTS.map((e) => (
                  <option key={e} value={e}>
                    {ACTIVITY_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              Desde
              <Input type="date" name="desde" defaultValue={filtros.desde} />
            </label>
            <label className="grid gap-1.5 text-sm">
              Hasta
              <Input type="date" name="hasta" defaultValue={filtros.hasta} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className={buttonVariants()}>
                Filtrar
              </button>
              <Link href="/actividad" className={buttonVariants({ variant: "ghost" })}>
                Limpiar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          {filas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay eventos con esos filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Fecha y hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="pr-4">IP / dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="max-w-56 truncate">{r.email || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
                          ALERTA.includes(r.event) ? "bg-red-100 text-red-800" : "bg-muted text-foreground",
                        )}
                      >
                        {ACTIVITY_LABELS[r.event] ?? r.event}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal">{r.detail}</TableCell>
                    <TableCell className="pr-4 text-xs text-muted-foreground" title={r.userAgent}>
                      <div>{r.ip || "—"}</div>
                      <div>{dispositivo(r.userAgent)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(pagina > 1 || hayMas) && (
        <div className="mt-4 flex justify-between">
          {pagina > 1 ? (
            <Link href={`/actividad?${query({ pagina: pagina - 1 })}`} className={buttonVariants({ variant: "outline" })}>
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          {hayMas && (
            <Link href={`/actividad?${query({ pagina: pagina + 1 })}`} className={buttonVariants({ variant: "outline" })}>
              Más antiguos →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
