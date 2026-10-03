"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { MATRIZ_UI, MatrizIcono, type ClaveMatriz } from "@/components/matriz";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const OPCIONES: { matriz: ClaveMatriz; href: string; detalle: string }[] = [
  { matriz: "ruido", href: "/proyectos?nuevo=1", detalle: "Ruido ambiental o emisión de ruido (Res. 0627 de 2006)" },
  { matriz: "aire", href: "/aire?nuevo=1", detalle: "Calidad del aire (Res. 2254 de 2017)" },
  { matriz: "vertimientos", href: "/vertimientos?nuevo=1", detalle: "Vertimientos (Res. 0631 de 2015)" },
];

/** Botón «Nuevo proyecto»: primero se elige la matriz y luego se abre su formulario. */
export function NuevoProyecto() {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>
        <Plus /> Nuevo proyecto
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>¿De qué matriz es el proyecto?</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {OPCIONES.map((o) => (
            <Link
              key={o.matriz}
              href={o.href}
              onClick={() => setAbierto(false)}
              className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <MatrizIcono matriz={o.matriz} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{MATRIZ_UI[o.matriz].nombre}</span>
                <span className="block text-xs text-muted-foreground">{o.detalle}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
