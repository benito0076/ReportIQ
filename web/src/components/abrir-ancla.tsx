"use client";

import { useEffect } from "react";

/** Abre la tarjeta plegable (<details>) a la que apunta el #ancla de la URL, o la que la contiene. */
export function AbrirAncla() {
  useEffect(() => {
    const abrir = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      // La tarjeta misma o la que contiene el ancla (p. ej. #informes dentro de su paso).
      const tarjeta = el?.closest("details");
      if (tarjeta && !tarjeta.open) {
        tarjeta.open = true;
        el?.scrollIntoView({ block: "start" });
      }
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
  return null;
}
