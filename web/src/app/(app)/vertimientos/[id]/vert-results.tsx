import { Notice } from "@/components/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResultadosVertimiento } from "@/lib/engine-types";
import { cn } from "@/lib/utils";

const num = (v: number | null, dec = 2) =>
  v === null ? "—" : v.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Resultados de vertimientos: datos de campo, incumplimientos y comparación con la Res. 0631 de 2015. */
export function VertResultados({ r }: { r: ResultadosVertimiento }) {
  const puntos = r.puntos.filter((p) => p.ensayos > 0);
  // Columnas de conformidad: punto evaluado × columna de límites que aplica.
  const conformidad = puntos
    .filter((p) => p.evaluar)
    .flatMap((p) => r.columnas.map((c, i) => ({ punto: p.nombre, i, c })).filter((x) => x.c.aplica));

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Puntos de muestreo</CardTitle>
          <CardDescription>Datos del reporte del laboratorio y de la FP-004 (muestreo compuesto).</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Punto</TableHead>
                <TableHead>Muestra</TableHead>
                <TableHead>Muestreo</TableHead>
                <TableHead className="text-center">Ensayos</TableHead>
                <TableHead>Campo (FP-004)</TableHead>
                <TableHead className="pr-4 text-right">Caudal promedio (L/s)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.puntos.map((p) => (
                <TableRow key={p.nombre} className="align-top">
                  <TableCell className="pl-4 whitespace-normal">
                    <div className="font-medium">{p.nombre}</div>
                    {p.punto_laboratorio && p.punto_laboratorio !== p.nombre && (
                      <div className="text-xs text-muted-foreground">Laboratorio: {p.punto_laboratorio}</div>
                    )}
                    {!p.evaluar && <div className="text-xs text-muted-foreground">Sin comparación con la norma</div>}
                  </TableCell>
                  <TableCell>{p.muestra ?? "—"}</TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {[p.tipo_muestreo, p.fecha_muestreo?.replace("T", " ").slice(0, 16)].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-center">{p.ensayos}</TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {p.campo
                      ? `Hoja «${p.campo.hoja}»: ${p.campo.mediciones} alícuotas${
                          p.campo.inicio ? `, ${p.campo.inicio.slice(0, 5)} a ${p.campo.fin?.slice(0, 5)}` : ""
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {p.campo ? num(p.campo.caudal_promedio_mls === null ? null : p.campo.caudal_promedio_mls / 1000, 3) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {conformidad.length > 0 &&
        (r.incumplimientos.length > 0 ? (
          <Notice tone="error" title={`No cumple la Resolución 0631 de 2015 (${r.incumplimientos.length})`}>
            <ul className="list-disc pl-4">
              {r.incumplimientos.map((x, i) => (
                <li key={i}>
                  {x.punto}: {x.parametro} = {x.resultado} frente a {x.limite} ({x.columna})
                </li>
              ))}
            </ul>
          </Notice>
        ) : (
          <Notice tone="success" title="Todos los parámetros con límite cumplen la Resolución 0631 de 2015." />
        ))}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Resultados frente a la Resolución 0631 de 2015</CardTitle>
          <CardDescription>
            Regla de decisión: aceptación simple. (*) Ensayo subcontratado. N.E.: no establecido por la norma.
            {r.columnas.some((c) => c.alcantarillado) &&
              " Art. 16: * exigencia multiplicada por 1,50; ** mismas exigencias de la actividad."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Parámetro</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>LCM</TableHead>
                {puntos.map((p) => (
                  <TableHead key={p.nombre} className="text-center whitespace-normal">
                    {p.nombre}
                  </TableHead>
                ))}
                {r.columnas.map((c, i) => (
                  <TableHead key={i} className="min-w-28 bg-muted/50 text-center whitespace-normal">
                    {c.titulo}
                  </TableHead>
                ))}
                {conformidad.map((x) => (
                  <TableHead key={`${x.punto}-${x.i}`} className="min-w-24 pr-4 text-center whitespace-normal">
                    Conformidad {x.punto}
                    {r.columnas.length > 1 && <div className="font-normal text-muted-foreground">({x.c.titulo})</div>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.filas.map((f) => (
                <TableRow key={f.clave}>
                  <TableCell className="pl-4 whitespace-normal">
                    {f.parametro}
                    {f.subcontratado && " (*)"}
                  </TableCell>
                  <TableCell>{f.unidad}</TableCell>
                  <TableCell>{f.lcm}</TableCell>
                  {puntos.map((p) => (
                    <TableCell key={p.nombre} className="text-center">
                      {f.resultados[p.nombre] ?? "—"}
                    </TableCell>
                  ))}
                  {f.limites.map((l, i) => (
                    <TableCell key={i} className="bg-muted/50 text-center whitespace-normal">
                      {l}
                    </TableCell>
                  ))}
                  {conformidad.map((x) => {
                    const estado = f.conformidad.find((c) => c.punto === x.punto && c.columna === x.i)?.estado ?? null;
                    return (
                      <TableCell
                        key={`${x.punto}-${x.i}`}
                        className={cn(
                          "pr-4 text-center",
                          estado === "No cumple" && "bg-red-100 font-medium text-red-800",
                          estado === "Cumple" && "text-green-800",
                        )}
                      >
                        {estado ?? "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
