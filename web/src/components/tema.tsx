"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Tema = "sistema" | "claro" | "oscuro";
const CLAVE = "tema";
const SIGUIENTE: Record<Tema, Tema> = { sistema: "claro", claro: "oscuro", oscuro: "sistema" };
const ETIQUETA: Record<Tema, string> = {
  sistema: "Tema: según el sistema",
  claro: "Tema: claro",
  oscuro: "Tema: oscuro",
};

/** Script que aplica el tema guardado antes de pintar la página (evita el destello). */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CLAVE}")||"sistema";var o=t==="oscuro"||(t==="sistema"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",o);}catch(e){}})();`;

function aplicar(tema: Tema) {
  const oscuro = tema === "oscuro" || (tema === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", oscuro);
}

function leer(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === "claro" || t === "oscuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

const EVENTO = "cambio-tema";

function suscribir(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** Botón que alterna sistema → claro → oscuro. */
export function SelectorTema() {
  const tema = useSyncExternalStore(suscribir, leer, () => "sistema" as Tema);

  // Con "sistema", sigue los cambios del sistema operativo mientras la página está abierta.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      if (leer() === "sistema") aplicar("sistema");
    };
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  function cambiar() {
    const nuevo = SIGUIENTE[tema];
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Sin almacenamiento (modo privado): el tema dura hasta recargar.
    }
    aplicar(nuevo);
    window.dispatchEvent(new Event(EVENTO));
  }

  const Icono = tema === "claro" ? Sun : tema === "oscuro" ? Moon : Monitor;
  return (
    <Button type="button" variant="ghost" size="icon" onClick={cambiar} aria-label={ETIQUETA[tema]} title={ETIQUETA[tema]}>
      <Icono />
    </Button>
  );
}
