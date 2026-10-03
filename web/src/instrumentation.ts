import * as Sentry from "@sentry/nextjs";

/**
 * Errores en producción: se reportan a Sentry (proyecto reportiq-web) cuando
 * SENTRY_DSN está definida. Sin ella (desarrollo, pruebas) no se envía nada.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/** Errores no controlados de páginas, Server Actions y rutas API. */
export const onRequestError = Sentry.captureRequestError;
