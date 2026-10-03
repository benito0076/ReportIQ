"use client";

import { useActionState, useState } from "react";
import { saveNormaAction } from "@/app/actions/vertimientos";
import type { ActionState } from "@/app/actions/state";
import { FormError, SubmitButton } from "@/components/form";
import { Notice } from "@/components/notice";
import { Input } from "@/components/ui/input";
import type { ConfigVertimiento } from "@/db/schema";
import ACTIVIDADES from "@/lib/res0631-actividades.json";
import { cn } from "@/lib/utils";

const normal = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const NOMBRES = new Map(ACTIVIDADES.flatMap((g) => g.actividades.map((a) => [a.clave, `Art. ${g.articulo}: ${a.actividad}`])));

export function NormaForm({ projectId, config }: { projectId: string; config: ConfigVertimiento }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveNormaAction.bind(null, projectId), {});
  const [elegidas, setElegidas] = useState<string[]>(config.actividades);
  const [busqueda, setBusqueda] = useState("");
  const q = normal(busqueda.trim());
  const coincide = (texto: string) => !q || q.split(/\s+/).every((p) => normal(texto).includes(p));
  const toggle = (clave: string, on: boolean) =>
    setElegidas((prev) => (on ? [...prev, clave] : prev.filter((c) => c !== clave)));

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && <FormError message={state.error} />}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-2">
        <p className="text-sm font-medium">Actividades productivas (artículos 8 a 15)</p>
        {elegidas.length > 0 ? (
          <ul className="grid gap-1 text-sm">
            {elegidas.map((c) => (
              <li key={c} className="rounded-md border border-primary/40 bg-primary/5 px-2 py-1">
                {NOMBRES.get(c) ?? c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin actividades: se reportan los resultados del laboratorio sin comparar con la norma.
          </p>
        )}
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar actividad: alimentos, curtido, hospital, sabores…"
          aria-label="Buscar actividad de la Resolución 0631"
        />
        <div className="grid gap-1 rounded-lg border">
          {ACTIVIDADES.map((g) => {
            const marcadas = g.actividades.filter((a) => elegidas.includes(a.clave)).length;
            const visibles = g.actividades.filter((a) => coincide(`${a.actividad} ${g.sector} art ${g.articulo}`));
            // Los grupos y actividades que no coinciden se ocultan (no se quitan: las marcadas se siguen enviando).
            return (
              <details
                key={g.articulo}
                className={cn("border-b last:border-b-0", q && visibles.length === 0 && "hidden")}
                open={marcadas > 0 || (!!q && visibles.length > 0)}
              >
                <summary className="cursor-pointer px-3 py-2 text-sm">
                  <span className="font-medium">Art. {g.articulo}</span> · {g.sector}
                  {marcadas > 0 && <span className="ml-1 text-primary">({marcadas})</span>}
                </summary>
                <div className="grid gap-1 px-3 pb-3">
                  {g.actividades.map((a) => (
                    <label
                      key={a.clave}
                      className={cn("flex items-start gap-2 text-sm", q && !visibles.includes(a) && "hidden")}
                    >
                      <input
                        type="checkbox"
                        name="actividades"
                        value={a.clave}
                        className="mt-1"
                        checked={elegidas.includes(a.clave)}
                        onChange={(e) => toggle(a.clave, e.target.checked)}
                      />
                      <span>{a.actividad}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="alcantarillado" className="mt-1" defaultChecked={config.alcantarillado} />
        <span>
          <span className="font-medium">Vertimiento al alcantarillado público (Art. 16).</span> Agrega por cada actividad la
          columna «Ajustado al Art. 16»: pH de 5,00 a 9,00 y DQO, DBO5, SST, SSED, grasas y aceites, fósforo y nitrógeno
          multiplicados por 1,50.
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consumoHumano" className="mt-1" defaultChecked={config.consumoHumano} />
        <span>
          <span className="font-medium">El receptor tiene uso para consumo humano y doméstico, y pecuario.</span> Los HAP
          pasan de «Análisis y Reporte» a un límite de 0,01 mg/L.
        </span>
      </label>
      <div>
        <SubmitButton>Guardar norma aplicable</SubmitButton>
      </div>
    </form>
  );
}
