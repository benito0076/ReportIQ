import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estado vacío: ícono, título, texto opcional y una acción. */
export function EmptyState({
  icono: Icono,
  titulo,
  texto,
  accion,
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  texto?: string;
  accion?: { href: string; texto: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-6" />
      </span>
      <p className="font-medium">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {accion && (
        <Link href={accion.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}>
          {accion.texto}
        </Link>
      )}
    </div>
  );
}
