import { CheckCircle2, ChevronDown, Circle, CircleDashed } from "lucide-react";
import type { Paso } from "@/lib/progreso";
import { cn } from "@/lib/utils";

const ICONO = {
  ok: { icono: CheckCircle2, cls: "text-exito" },
  pendiente: { icono: Circle, cls: "text-aviso" },
  opcional: { icono: CircleDashed, cls: "text-muted-foreground" },
} as const;

/**
 * Tarjeta de un paso del proyecto que se pliega: los pasos completos empiezan
 * cerrados y muestran un resumen en una línea; los pendientes, abiertos.
 */
export function PasoCard({
  id,
  numero,
  titulo,
  descripcion,
  paso,
  resumen,
  siempreAbierto = false,
  sinMargen = false,
  children,
}: {
  id: string;
  numero: number;
  titulo: string;
  descripcion?: React.ReactNode;
  paso?: Paso;
  /** Texto en una línea cuando la tarjeta está cerrada (por defecto, el detalle del paso). */
  resumen?: string;
  siempreAbierto?: boolean;
  /** Contenido a todo el ancho (tablas). */
  sinMargen?: boolean;
  children: React.ReactNode;
}) {
  const estado = paso?.estado ?? "pendiente";
  const { icono: Icono, cls } = ICONO[estado];
  return (
    <details
      id={id}
      open={siempreAbierto || estado !== "ok"}
      className="group/paso scroll-mt-20 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 select-none hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <Icono className={cn("mt-0.5 size-5 shrink-0", cls)} aria-label={estado === "ok" ? "Completo" : estado === "opcional" ? "Opcional" : "Pendiente"} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight">
            <span className="mr-1 text-muted-foreground">{numero}.</span>
            {titulo}
          </span>
          <span className="block truncate text-muted-foreground group-open/paso:hidden">{resumen ?? paso?.detalle}</span>
          {descripcion && <span className="hidden text-muted-foreground group-open/paso:block">{descripcion}</span>}
        </span>
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open/paso:rotate-180" aria-hidden />
      </summary>
      <div className={cn("border-t py-4", sinMargen ? "grid gap-4" : "px-4")}>{children}</div>
    </details>
  );
}
