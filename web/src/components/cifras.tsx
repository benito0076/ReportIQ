import { cn } from "@/lib/utils";

export interface Cifra {
  etiqueta: string;
  valor: number | string;
  detalle?: string;
  tono?: "normal" | "exito" | "peligro";
}

/** Fila de cifras clave encima de las tablas de resultados. */
export function Cifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cifras.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      {cifras.map((c) => (
        <div
          key={c.etiqueta}
          className={cn(
            "rounded-xl px-4 py-3 ring-1",
            c.tono === "peligro"
              ? "bg-peligro-suave text-peligro-texto ring-peligro-borde"
              : c.tono === "exito"
                ? "bg-exito-suave text-exito-texto ring-exito-borde"
                : "bg-card ring-foreground/10",
          )}
        >
          <div className="text-xs opacity-80">{c.etiqueta}</div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{c.valor}</div>
          {c.detalle && <div className="truncate text-xs opacity-80">{c.detalle}</div>}
        </div>
      ))}
    </div>
  );
}
