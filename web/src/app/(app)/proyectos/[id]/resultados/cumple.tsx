import { cn } from "@/lib/utils";

export function Cumple({ v }: { v: "Si" | "No" | null }) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium",
        v === "Si" ? "bg-exito-suave text-exito-texto" : "bg-peligro-suave text-peligro-texto",
      )}
    >
      {v === "Si" ? "Cumple" : "No cumple"}
    </span>
  );
}
