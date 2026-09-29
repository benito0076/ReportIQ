import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ESQUEMAS, ESQUEMA_LABELS } from "@/db/enums";
import type { ResultadosEmision } from "@/lib/engine-types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Cumple } from "./cumple";

/** Resultados de un proyecto de emisión: una tabla por jornada y el barrido. */
export function EmisionResultados({ r }: { r: ResultadosEmision }) {
  const esquemas = ESQUEMAS.filter((e) => r.puntos.some((p) => p.esquemas[e]));
  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Emisión de ruido — comparación con la Resolución 0627 (Art. 9)</CardTitle>
          <CardDescription>
            Emisión = 10·log(10^(LRAeq/10) − 10^(Residual/10)). Si no se midió el residual se usa el L90 corregido; si la
            diferencia es ≤ 3 dB(A) la emisión es del orden del residual (fila resaltada).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 px-0">
          {esquemas.map((e) => (
            <div key={e} className="grid gap-2">
              <h3 className="px-4 text-sm font-semibold">{ESQUEMA_LABELS[e]}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Punto</TableHead>
                    <TableHead className="text-center">LAeq</TableHead>
                    <TableHead className="text-center">KI / KT</TableHead>
                    <TableHead className="text-center">LRAeq corr.</TableHead>
                    <TableHead className="text-center">Residual</TableHead>
                    <TableHead className="text-center">Diferencia</TableHead>
                    <TableHead className="text-center">Emisión</TableHead>
                    <TableHead className="pr-4 text-center">Estándar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.puntos
                    .filter((p) => p.esquemas[e])
                    .map((p) => {
                      const x = p.esquemas[e]!;
                      return (
                        <TableRow key={p.no_punto} className={cn(x.del_orden_del_residual && "bg-lime-50")}>
                          <TableCell className="pl-4 font-medium">
                            P{p.no_punto}. {p.nombre}
                          </TableCell>
                          <TableCell className="text-center">{fmtNum(x.medicion.laeq)}</TableCell>
                          <TableCell className="text-center">
                            {fmtNum(x.medicion.ki, 0)} / {fmtNum(x.medicion.kt, 0)}
                          </TableCell>
                          <TableCell className="text-center">{fmtNum(x.medicion.lraeq_corregido)}</TableCell>
                          <TableCell className="text-center">
                            {fmtNum(x.residual)}
                            <div className="text-[11px] text-muted-foreground">
                              {x.residual_origen === "medido" ? "medido" : "L90 corregido"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{fmtNum(x.diferencia)}</TableCell>
                          <TableCell className="text-center font-semibold">
                            <div>{fmtNum(x.emision)}</div>
                            {x.cumple && <Cumple v={x.cumple} />}
                          </TableCell>
                          <TableCell className="pr-4 text-center">{x.estandar ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      {r.barrido.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Barrido perimetral</CardTitle>
            <CardDescription>De mayor a menor Leq. Resaltados: barridos elegidos como puntos de medición.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Barrido</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="pr-4 text-center">Leq dB(A)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.barrido.map((b) => (
                  <TableRow key={b.nombre} className={cn(b.seleccionado && "bg-lime-50")}>
                    <TableCell className="pl-4 font-medium">{b.nombre}</TableCell>
                    <TableCell>{b.condicion}</TableCell>
                    <TableCell>{b.inicio ?? "—"}</TableCell>
                    <TableCell>{b.fin ?? "—"}</TableCell>
                    <TableCell className="pr-4 text-center">{fmtNum(b.leq)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
