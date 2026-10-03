"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Último recurso ante un error de la aplicación: lo reporta y ofrece reintentar. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Algo salió mal</h1>
        <p style={{ color: "#555" }}>El error quedó registrado. Intente de nuevo; si persiste, avise al administrador.</p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #ccc", cursor: "pointer" }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
