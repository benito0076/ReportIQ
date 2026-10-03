import { AlertTriangle, CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import type { Aviso, Paso } from "@/lib/progreso";
import { cn } from "@/lib/utils";

const ESTILO = {
  ok: { icono: CheckCircle2, cls: "border-exito-borde bg-exito-suave text-exito-texto" },
  pendiente: { icono: Circle, cls: "border-aviso-borde bg-aviso-suave text-aviso-texto" },
  opcional: { icono: CircleDashed, cls: "border-border bg-muted/40 text-muted-foreground" },
} as const;

/** Barra de pasos del proyecto: cada paso enlaza a su tarjeta. */
export function ProgresoPasos({ pasos }: { pasos: Paso[] }) {
  const listos = pasos.filter((p) => p.estado === "ok").length;
  return (
    <nav aria-label="Avance del proyecto" className="grid gap-2">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">Avance</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${(listos / pasos.length) * 100}%` }} />
        </div>
        <span className="text-muted-foreground">
          {listos}/{pasos.length}
        </span>
      </div>
      <ol className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", pasos.length <= 5 ? "lg:grid-cols-5" : "lg:grid-cols-6")}>
        {pasos.map((p, i) => {
          const { icono: Icono, cls } = ESTILO[p.estado];
          return (
            <li key={p.ancla}>
              <a
                href={`#${p.ancla}`}
                className={cn("flex h-full items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:brightness-95", cls)}
              >
                <Icono className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {i + 1}. {p.titulo}
                  </span>
                  <span className="block truncate opacity-80">{p.detalle}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Lista de verificación antes de procesar o generar el informe. */
export function ListaVerificacion({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-exito-borde bg-exito-suave px-3 py-2 text-sm text-exito-texto">
        <CheckCircle2 className="size-4" /> Todo listo: el informe saldrá completo.
      </p>
    );
  }
  const bloquean = avisos.filter((a) => a.nivel === "bloquea");
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <p className="mb-1 font-medium">
        {bloquean.length ? "Antes de procesar" : `Revise antes de generar el informe (${avisos.length})`}
      </p>
      <ul className="grid gap-1">
        {avisos.map((a, i) => (
          <li key={i} className="flex items-start gap-2">
            {a.nivel === "bloquea" ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-peligro" aria-label="Bloquea" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-aviso" aria-label="Revisar" />
            )}
            <a href={`#${a.ancla}`} className="hover:underline">
              {a.texto}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
