import { InformesTabla } from "@/components/informes-tabla";
import { listReportsDetalle } from "@/server/aprobaciones";
import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ESQUEMAS, ESQUEMA_LABELS, reportLabel, type Esquema } from "@/db/enums";
import type { ResultadoPunto, ResultadosAmbiental } from "@/lib/engine-types";
import { fmtNum, formatDateTime } from "@/lib/format";
import { listEquipment, normalizeSerial } from "@/server/equipment";
import { requireUser } from "@/lib/session";
import { getProject, listMemoryFiles } from "@/server/projects";
import { GenerateButtons, ProcessButton } from "./engine-buttons";
import { Cumple } from "./cumple";
import { EmisionResultados } from "./emision-results";

export const metadata: Metadata = { title: "Resultados e informes" };

function Nivel({ p, e }: { p: ResultadoPunto; e: Esquema }) {
  const v = p.esquemas[e]?.lraeq_resultante;
  return <>{fmtNum(v)}</>;
}

function AmbientalComparacion({ r }: { r: ResultadosAmbiental }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comparación con la Resolución 0627</CardTitle>
        <CardDescription>Nivel resultante LRAeq,1h en dB(A) por punto y jornada.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Punto</TableHead>
              <TableHead className="text-center">Diurno hábil</TableHead>
              <TableHead className="text-center">Diurno no hábil</TableHead>
              <TableHead className="text-center">Estándar diurno</TableHead>
              <TableHead className="text-center">Nocturno hábil</TableHead>
              <TableHead className="text-center">Nocturno no hábil</TableHead>
              <TableHead className="pr-4 text-center">Estándar nocturno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.puntos.map((p) => (
              <TableRow key={p.no_punto}>
                <TableCell className="pl-4 font-medium">
                  {p.no_punto}. {p.nombre}
                </TableCell>
                {(["DH", "DNH"] as const).map((e) => (
                  <TableCell key={e} className="text-center">
                    <div><Nivel p={p} e={e} /></div>
                    {p.esquemas[e] && <Cumple v={p.cumple[e]} />}
                  </TableCell>
                ))}
                <TableCell className="text-center">{p.estandar_diurno ?? "—"}</TableCell>
                {(["NDH", "NDNH"] as const).map((e) => (
                  <TableCell key={e} className="text-center">
                    <div><Nivel p={p} e={e} /></div>
                    {p.esquemas[e] && <Cumple v={p.cumple[e]} />}
                  </TableCell>
                ))}
                <TableCell className="pr-4 text-center">{p.estandar_nocturno ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AmbientalDetalle({ r }: { r: ResultadosAmbiental }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle por dirección</CardTitle>
        <CardDescription>Correcciones aplicadas a cada medición (KI impulsividad, KT tono).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {r.puntos.map((p) =>
          ESQUEMAS.filter((e) => p.esquemas[e]).map((e) => {
            const d = p.esquemas[e]!;
            return (
              <details key={`${p.no_punto}-${e}`} className="rounded-lg border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  {p.nombre} · {ESQUEMA_LABELS[e]} — LRAeq,1h {fmtNum(d.lraeq_resultante)} dB(A)
                </summary>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {["Dirección", "Lmax", "Lmin", "L90", "LAeq", "LAIeq", "Li", "KI", "KT", "Corrección", "LRAeq corr.", "Tipo de ajuste"].map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.direcciones.map((x) => (
                        <tr key={x.direccion} className="border-t">
                          <td className="px-2 py-1.5">{x.direccion}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.lmax)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.lmin)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.l90)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.laeq)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.laieq)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.li)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.ki, 0)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.kt, 0)}</td>
                          <td className="px-2 py-1.5">{fmtNum(x.correccion, 0)}</td>
                          <td className="px-2 py-1.5 font-medium">{fmtNum(x.lraeq_corregido)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{x.tipo_ajuste}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          }),
        )}
      </CardContent>
    </Card>
  );
}

export default async function ResultsPage({ params }: PageProps<"/proyectos/[id]/resultados">) {
  const user = await requireUser();
  const { id } = await params;
  const [project, files, reps, inventory] = await Promise.all([
    getProject(id),
    listMemoryFiles(id),
    listReportsDetalle(id),
    listEquipment(),
  ]);
  const r = project.resultados;
  const sinMemorias = files.length === 0;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Procesamiento</CardTitle>
          <CardDescription>
            Lee las memorias, aplica las correcciones por impulsividad y tono de la Res. 0627 y compara con el
            estándar de cada sector.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sinMemorias ? (
            <Notice tone="info">
              Aún no hay memorias cargadas.{" "}
              <Link href={`/proyectos/${id}/memorias`} className="underline">
                Subir memorias
              </Link>
            </Notice>
          ) : r && project.procesadoAt ? (
            <p className="text-sm text-muted-foreground">Procesado: {formatDateTime(project.procesadoAt)}</p>
          ) : (
            <Notice tone="warning">
              {reps.length > 0
                ? "Los datos cambiaron desde el último procesamiento: vuelva a procesar para ver los resultados actualizados."
                : "El proyecto aún no se ha procesado."}
            </Notice>
          )}
          <ProcessButton projectId={id} disabled={sinMemorias} />
        </CardContent>
      </Card>

      {r && (
        <>
          {r.tipo === "emision" ? <EmisionResultados r={r} /> : <AmbientalComparacion r={r} />}

          {r.advertencias.length > 0 && (
            <Notice tone="warning" title={`Advertencias (${r.advertencias.length})`}>
              <ul className="list-disc pl-4">
                {r.advertencias.map((a, i) => (
                  <li key={i}>
                    <strong>
                      {a.punto} / {a.esquema}
                      {a.direccion ? ` / ${a.direccion}` : ""}:
                    </strong>{" "}
                    {a.mensaje}
                  </li>
                ))}
              </ul>
            </Notice>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Equipos de medición detectados</CardTitle>
              <CardDescription>Según el número de serie leído en las memorias.</CardDescription>
            </CardHeader>
            <CardContent>
              {r.equipos_detectados.length === 0 ? (
                <p className="text-sm text-muted-foreground">No se detectó ningún número de serie en las memorias.</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {r.equipos_detectados.map((eq) => {
                    const match = inventory.find((i) => normalizeSerial(i.serial) === normalizeSerial(eq.serial));
                    return (
                      <li key={eq.serial}>
                        Serial <strong>{eq.serial}</strong>:{" "}
                        {match ? (
                          `${match.nombre} (${match.codigo})`
                        ) : (
                          <span className="text-aviso">
                            {eq.modelo ?? "Equipo"} no registrado en el inventario —{" "}
                            <Link href="/equipos" className="underline">
                              agregarlo
                            </Link>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {r.tipo !== "emision" && <AmbientalDetalle r={r} />}
        </>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Informes y entregables</CardTitle>
          <CardDescription>
            El informe Word se rellena con la plantilla de la empresa (menú Ajustes) o con la plantilla incluida.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <GenerateButtons projectId={id} tipo={project.tipo} disabled={sinMemorias} />
          <InformesTabla projectId={id} informes={reps} user={user} etiqueta={(k) => reportLabel(k, project.tipo)} />
        </CardContent>
      </Card>
    </div>
  );
}
