import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-muted-foreground">El elemento que busca no existe o fue eliminado.</p>
      <Link href="/inicio" className={buttonVariants()}>
        Volver al inicio
      </Link>
    </main>
  );
}
