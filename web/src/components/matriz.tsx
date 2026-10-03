import { Droplets, Volume2, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClaveMatriz = "ruido" | "aire" | "vertimientos";

/** Ícono y color de cada matriz (ruido violeta, aire celeste, agua azul). */
export const MATRIZ_UI: Record<ClaveMatriz, { icono: LucideIcon; texto: string; fondo: string; borde: string; nombre: string }> = {
  ruido: { icono: Volume2, texto: "text-ruido", fondo: "bg-ruido/10", borde: "border-ruido/40", nombre: "Ruido" },
  aire: { icono: Wind, texto: "text-aire", fondo: "bg-aire/10", borde: "border-aire/40", nombre: "Calidad del aire" },
  vertimientos: { icono: Droplets, texto: "text-agua", fondo: "bg-agua/10", borde: "border-agua/40", nombre: "Vertimientos" },
};

/** Ícono de la matriz en un recuadro de su color. */
export function MatrizIcono({ matriz, size = "md", className }: { matriz: ClaveMatriz; size?: "sm" | "md" | "lg"; className?: string }) {
  const ui = MATRIZ_UI[matriz];
  const Icono = ui.icono;
  const caja = { sm: "size-6 rounded-md", md: "size-9 rounded-lg", lg: "size-11 rounded-xl" }[size];
  const icono = { sm: "size-3.5", md: "size-5", lg: "size-6" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", caja, ui.fondo, ui.texto, className)} aria-hidden>
      <Icono className={icono} />
    </span>
  );
}
