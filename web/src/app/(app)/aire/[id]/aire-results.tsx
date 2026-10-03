import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cifras } from "@/components/cifras";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EstadisticaAire, ResultadosAire } from "@/lib/engine-types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const NOMBRES: Record<string, string> = {
  PM10: "PM10",
  "PM2.5": "PM2,5",
  SO2: "SO₂",
  NO2: "NO₂",
  CO: "CO",
  O3: "O₃",
};

const CATEGORIAS = [
  { nombre: "Buena", clase: "bg-exito-suave text-exito-texto" },
  { nombre: "Aceptable", clase: "bg-yellow-100 text-yellow-800" },
  { nombre: "Dañina a la salud para grupos sensibles", clase: "bg-orange-100 text-orange-800" },
  { nombre: "Dañina a la salud", clase: "bg-peligro-suave text-peligro-texto" },
  { nombre: "Muy dañina a la salud", clase: "bg-purple-100 text-purple-800" },
  { nombre: "Peligrosa", clase: "bg-aviso/15 text-aviso-texto" },
];

/** Valor con "<" cuando está bajo el límite de cuantificación. */
function conc(v: number | null | undefined, bajoLc = false, dec = 2) {
  if (v === null || v === undefined) return "—";
  return `${bajoLc ? "<" : ""}${fmtNum(v, dec)}`;
}

interface FilaResumen {
  contaminante: string;
  estacion: string;
  exposicion: string;
  est: Pick<EstadisticaAire, "n" | "promedio" | "maximo" | "minimo"> | null;
  limite: number | null;
  excedencias: number;
  bajoLc: boolean;
  validas: number | null;
}

function resumen(r: ResultadosAire): FilaResumen[] {
  const nombre = (n: number) => r.estaciones.find((e) => e.numero === n)?.nombre ?? `Estación ${n}`;
  const filas: FilaResumen[] = [];
  for (const s of r.manuales) {
    const limite = r.limites[s.contaminante]?.["24h"] ?? null;
    filas.push({
      contaminante: s.contaminante,
      estacion: nombre(s.estacion),
      exposicion: "24 horas",
      est: s.estadistica,
      limite,
      excedencias: limite === null ? 0 : s.muestras.filter((m) => (m.concentracion ?? 0) > limite).length,
      bajoLc: s.bajo_lc,
      validas: s.pct_validas,
    });
  }
  for (const s of r.automaticos) {
    for (const [exp, clave, attr] of [
      ["1 hora", "1h", "max_horario"],
      ["8 horas", "8h", "max_8h"],
    ] as const) {
      const limite = r.limites[s.contaminante]?.[clave];
      if (limite === undefined) continue;
      const xs = s.dias.map((d) => d[attr]).filter((v): v is number => v !== null);
      if (!xs.length) continue;
      filas.push({
        contaminante: s.contaminante,
        estacion: nombre(s.estacion),
        exposicion: `${exp} (máx. diario)`,
        est: { n: xs.length, promedio: xs.reduce((a, b) => a + b, 0) / xs.length, maximo: Math.max(...xs), minimo: Math.min(...xs) },
        limite,
        excedencias: xs.filter((x) => x > limite).length,
        bajoLc: false,
        validas: null,
      });
    }
  }
  return filas;
}

/** Tabla fecha × estación de un contaminante (como las del informe). */
function TablaDiaria({
  r,
  titulo,
  series,
  limite,
}: {
  r: ResultadosAire;
  titulo: string;
  series: { estacion: number; bajoLc: boolean; datos: { fecha: string; valor: number | null; bajoLc?: boolean; valida?: boolean }[] }[];
  limite: number | null;
}) {
  const estaciones = r.estaciones.filter((e) => series.some((s) => s.estacion === e.numero));
  const fechas = [...new Set(series.flatMap((s) => s.datos.map((d) => d.fecha)))].sort();
  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{titulo}</summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
              {estaciones.map((e) => (
                <th key={e.numero} className="px-2 py-1.5 text-center font-medium">
                  {e.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fechas.map((f) => (
              <tr key={f} className="border-t">
                <td className="px-2 py-1 whitespace-nowrap">{f}</td>
                {estaciones.map((e) => {
                  const d = series.find((s) => s.estacion === e.numero)?.datos.find((x) => x.fecha === f);
                  const excede = d?.valor != null && limite !== null && d.valor > limite;
                  return (
                    <td
                      key={e.numero}
                      className={cn("px-2 py-1 text-center", excede && "bg-peligro-suave font-medium text-peligro", d?.valida === false && "text-aviso")}
                      title={d?.valida === false ? "Muestra fuera de los criterios de validez" : undefined}
                    >
                      {d ? conc(d.valor, d.bajoLc) : "---"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function AireResultados({ r }: { r: ResultadosAire }) {
  const filas = resumen(r);
  const compuestos = [...new Set(r.cov.map((c) => c.compuesto))];
  const conExcedencias = filas.filter((f) => f.excedencias > 0);
  const muestras = r.manuales.reduce((n, s) => n + s.muestras.length, 0) + r.automaticos.reduce((n, s) => n + s.dias.length, 0);
  return (
    <>
      <Cifras
        cifras={[
          { etiqueta: "Estaciones", valor: r.estaciones.length, detalle: r.estaciones.map((e) => e.nombre).join(", ") },
          { etiqueta: "Contaminantes", valor: r.contaminantes.length, detalle: r.contaminantes.join(", ") },
          { etiqueta: "Días / muestras", valor: muestras, detalle: "Manuales y días de equipos automáticos" },
          {
            etiqueta: "Superan el límite",
            valor: conExcedencias.length,
            detalle: conExcedencias.length
              ? [...new Set(conExcedencias.map((f) => `${f.contaminante} (${f.estacion})`))].join(", ")
              : "Ninguna comparación supera la Res. 2254",
            tono: conExcedencias.length ? "peligro" : "exito",
          },
        ]}
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Comparación con la Resolución 2254 de 2017</CardTitle>
          <CardDescription>
            Concentraciones a condiciones de referencia (25 °C y 760 mmHg). Los valores con «&lt;» están bajo el límite de
            cuantificación del laboratorio.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Contaminante</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Exposición</TableHead>
                <TableHead className="text-center">Datos</TableHead>
                <TableHead className="text-center">Promedio (µg/m³)</TableHead>
                <TableHead className="text-center">Máximo</TableHead>
                <TableHead className="text-center">Mínimo</TableHead>
                <TableHead className="text-center">Límite</TableHead>
                <TableHead className="pr-4 text-center">Cumple</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-4 font-medium">{NOMBRES[f.contaminante] ?? f.contaminante}</TableCell>
                  <TableCell className="max-w-56 truncate" title={f.estacion}>
                    {f.estacion}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{f.exposicion}</TableCell>
                  <TableCell className="text-center">
                    {f.est?.n ?? "—"}
                    {f.validas !== null && f.validas < 100 && (
                      <div className="text-[11px] text-aviso">{fmtNum(f.validas, 0)} % válidas</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{conc(f.est?.promedio, f.bajoLc)}</TableCell>
                  <TableCell className="text-center">{conc(f.est?.maximo, f.bajoLc)}</TableCell>
                  <TableCell className="text-center">{conc(f.est?.minimo, f.bajoLc)}</TableCell>
                  <TableCell className="text-center">{f.limite?.toLocaleString("es-CO") ?? "—"}</TableCell>
                  <TableCell className="pr-4 text-center">
                    {f.excedencias === 0 ? (
                      <Badge variant="secondary" className="bg-exito-suave text-exito-texto">Sí</Badge>
                    ) : (
                      <Badge variant="destructive">{f.excedencias} excedencia(s)</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Concentraciones diarias</CardTitle>
          <CardDescription>
            En rojo los valores sobre el límite; en ámbar las muestras fuera de los criterios de validez de la plantilla.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(["PM10", "PM2.5", "SO2"] as const).map((c) => {
            const series = r.manuales.filter((s) => s.contaminante === c);
            if (!series.length) return null;
            return (
              <TablaDiaria
                key={c}
                r={r}
                titulo={`${NOMBRES[c]} – concentración de 24 horas (límite ${r.limites[c]["24h"]} µg/m³)`}
                limite={r.limites[c]["24h"]}
                series={series.map((s) => ({
                  estacion: s.estacion,
                  bajoLc: s.bajo_lc,
                  datos: s.muestras
                    .filter((m) => m.fecha)
                    .map((m) => ({ fecha: m.fecha!, valor: m.concentracion, bajoLc: m.bajo_lc, valida: m.valida })),
                }))}
              />
            );
          })}
          {(["NO2", "CO", "O3"] as const).flatMap((c) => {
            const series = r.automaticos.filter((s) => s.contaminante === c);
            if (!series.length) return [];
            return (
              [
                ["1h", "max_horario", "máximo horario"],
                ["8h", "max_8h", "máxima media móvil de 8 horas"],
              ] as const
            )
              .filter(([clave]) => r.limites[c]?.[clave] !== undefined)
              .map(([clave, attr, texto]) => (
                <TablaDiaria
                  key={`${c}-${clave}`}
                  r={r}
                  titulo={`${NOMBRES[c]} – ${texto} (límite ${r.limites[c][clave].toLocaleString("es-CO")} µg/m³)`}
                  limite={r.limites[c][clave]}
                  series={series.map((s) => ({
                    estacion: s.estacion,
                    bajoLc: false,
                    datos: s.dias.map((d) => ({ fecha: d.fecha, valor: d[attr] })),
                  }))}
                />
              ));
          })}
        </CardContent>
      </Card>

      {compuestos.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Compuestos orgánicos volátiles (COV)</CardTitle>
            <CardDescription>Informativo: la Resolución 2254 de 2017 no fija límites para estos compuestos.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Estación</TableHead>
                  {compuestos.map((c) => (
                    <TableHead key={c} className="text-center">
                      {c} (promedio / máx.)
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.estaciones
                  .filter((e) => r.cov.some((c) => c.estacion === e.numero))
                  .map((e) => (
                    <TableRow key={e.numero}>
                      <TableCell className="pl-4 font-medium">{e.nombre}</TableCell>
                      {compuestos.map((c) => {
                        const s = r.cov.find((x) => x.compuesto === c && x.estacion === e.numero);
                        return (
                          <TableCell key={c} className="text-center">
                            {s?.estadistica
                              ? `${conc(s.estadistica.promedio, s.bajo_lc, 3)} / ${conc(s.estadistica.maximo, s.bajo_lc, 3)}`
                              : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Índice de calidad del aire (ICA)</CardTitle>
          <CardDescription>
            Días por categoría. PM10 y PM2,5 con la concentración de 24 h, NO₂ con el máximo horario y CO y O₃ con la
            máxima media móvil de 8 h. El SO₂ no se calcula (muestras de 24 h; el ICA es horario).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Estación</TableHead>
                <TableHead>Contaminante</TableHead>
                <TableHead className="text-center">ICA máximo</TableHead>
                <TableHead className="pr-4">Días por categoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.estaciones.flatMap((e) =>
                Object.entries(r.ica[String(e.numero)] ?? {}).map(([c, dias]) => {
                  const icas = dias.map((d) => d.ica).filter((v): v is number => v !== null);
                  return (
                    <TableRow key={`${e.numero}-${c}`}>
                      <TableCell className="pl-4">{e.nombre}</TableCell>
                      <TableCell className="font-medium">{NOMBRES[c] ?? c}</TableCell>
                      <TableCell className="text-center">{icas.length ? fmtNum(Math.max(...icas), 0) : "—"}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex flex-wrap gap-1">
                          {CATEGORIAS.map((cat) => {
                            const n = dias.filter((d) => d.categoria === cat.nombre).length;
                            return n ? (
                              <span key={cat.nombre} className={cn("rounded px-1.5 py-0.5 text-xs", cat.clase)}>
                                {cat.nombre}: {n}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
