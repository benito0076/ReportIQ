import "server-only";
import type { ReportKind } from "@/db/enums";
import type { ResultadosAire, ResultadosProyecto } from "./engine-types";
import { EngineError } from "./errors";

/**
 * Cliente del motor Python (engine/app.py). Se llama solo desde el servidor
 * con la clave ENGINE_API_KEY; el navegador nunca habla con el motor.
 */

export interface ArchivoRemoto {
  url: string;
  nombre: string;
}

export interface PuntoPayload {
  no_punto: number;
  nombre: string;
  sector: string;
  este: string;
  norte: string;
  incertidumbre: number;
  altitud: string;
  descripcion: string;
  fuentes: string;
  foto: ArchivoRemoto | null;
  memorias: Record<string, Record<string, ArchivoRemoto>>;
}

export interface BarridoPayload {
  nombre: string;
  condicion: "Encendido" | "Apagado";
  seleccionado: boolean;
  archivo: ArchivoRemoto;
}

export interface ProyectoPayload {
  tipo: "ambiental" | "emision";
  nombre_proyecto: string;
  codigo_informe: string;
  cliente: string;
  puntos: PuntoPayload[];
  /** Datos de redacción del informe (claves de engine/schemas.py InformeIn). */
  informe: Record<string, string>;
  barrido: BarridoPayload[];
  meteorologia: ArchivoRemoto | null;
}

/** Proyecto de calidad del aire (engine/schemas.py ProyectoAireIn). */
export interface ProyectoAirePayload {
  nombre_proyecto: string;
  codigo: string;
  cliente: string;
  estaciones: {
    numero: number;
    nombre: string;
    codigo: string;
    codigo_anla: string;
    longitud: string;
    latitud: string;
    descripcion: string;
  }[];
  plantillas: Partial<Record<string, ArchivoRemoto>>;
  meteorologia: ArchivoRemoto | null;
  /** Datos de redacción del informe (claves de engine/schemas.py InformeIn). */
  informe: Record<string, string>;
}

export interface GenerarPayload {
  proyecto: ProyectoPayload;
  tipo: ReportKind;
  plantilla: ArchivoRemoto | null;
  equipos: { nombre: string; codigo: string; serial: string }[];
  elaborado_por: string;
}

export interface Entregable {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  advertencias: string[];
}

// Las isófonas con mapa satelital pueden tardar: margen amplio, por debajo
// del maxDuration (300 s) de las rutas que llaman al motor.
const TIMEOUT_MS = 280_000;

function config() {
  const url = process.env.ENGINE_URL;
  const key = process.env.ENGINE_API_KEY;
  if (!url || !key) {
    throw new EngineError("El motor de cálculo no está configurado (ENGINE_URL / ENGINE_API_KEY).", 503);
  }
  return { url: url.replace(/\/$/, ""), key };
}

// Render (plan gratuito) duerme el motor tras 15 min sin tráfico: mientras
// despierta, su proxy responde 429/502/503/504 sin llegar a la aplicación
// (los errores propios del motor siempre traen `detail`). Se reintenta con
// espera creciente durante este margen como máximo.
const WAKE_WINDOW_MS = 150_000;
const RETRY_STATUS = new Set([429, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera sugerida por Retry-After (segundos), acotada; si no hay, backoff. */
function retryDelay(res: Response, attempt: number) {
  const header = Number(res.headers.get("retry-after"));
  const backoff = Math.min(3_000 * 2 ** attempt, 20_000);
  return Number.isFinite(header) && header > 0 ? Math.min(header * 1000, 20_000) : backoff;
}

async function errorDetail(res: Response) {
  try {
    return ((await res.json()) as { detail?: string }).detail ?? "";
  } catch {
    return ""; // cuerpo no JSON (p. ej. la página del proxy de Render)
  }
}

/**
 * Despierta el motor con GET /health (petición liviana) antes de enviar el
 * trabajo, para no reenviar el cuerpo completo mientras Render lo arranca.
 */
async function wake(url: string, started: number) {
  for (let attempt = 0; Date.now() - started < WAKE_WINDOW_MS; attempt++) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
      if (res.ok) return;
      await sleep(retryDelay(res, attempt));
    } catch {
      await sleep(Math.min(3_000 * 2 ** attempt, 20_000));
    }
  }
}

async function call(path: string, body: unknown): Promise<Response> {
  const { url, key } = config();
  const started = Date.now();
  await wake(url, started);
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${url}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(Math.max(TIMEOUT_MS - (Date.now() - started), 1_000)),
        cache: "no-store",
      });
    } catch (e) {
      const timeout = e instanceof DOMException && e.name === "TimeoutError";
      throw new EngineError(
        timeout
          ? "El motor de cálculo tardó demasiado en responder. Intente de nuevo."
          : "No se pudo contactar el motor de cálculo. Verifique que esté en línea.",
        timeout ? 504 : 502,
      );
    }
    if (res.ok) return res;
    const detail = await errorDetail(res);
    if (RETRY_STATUS.has(res.status) && !detail) {
      const wait = retryDelay(res, attempt);
      if (Date.now() - started + wait <= WAKE_WINDOW_MS) {
        await sleep(wait);
        continue;
      }
      throw new EngineError(
        "El motor de cálculo está iniciando o saturado. Espere un minuto e intente de nuevo.",
        503,
      );
    }
    if (res.status === 422 && detail) throw new EngineError(detail, 422);
    if (res.status >= 500 && detail) throw new EngineError(detail, 502);
    if (res.status === 401) throw new EngineError("La clave del motor de cálculo (ENGINE_API_KEY) no coincide.", 502);
    throw new EngineError(`El motor de cálculo respondió con un error (HTTP ${res.status}).`, 502);
  }
}

export async function procesar(proyecto: ProyectoPayload): Promise<ResultadosProyecto> {
  const res = await call("/v1/procesar", { proyecto });
  return (await res.json()) as ResultadosProyecto;
}

export async function procesarAire(proyecto: ProyectoAirePayload): Promise<ResultadosAire> {
  const res = await call("/v1/aire/procesar", { proyecto });
  return (await res.json()) as ResultadosAire;
}

export async function generarAire(proyecto: ProyectoAirePayload, tipo: "excel" | "word"): Promise<Entregable> {
  return entregable(await call("/v1/aire/generar", { proyecto, tipo }), tipo === "word" ? "docx" : "xlsx");
}

export async function generar(payload: GenerarPayload): Promise<Entregable> {
  return entregable(await call("/v1/generar", payload), payload.tipo);
}

async function entregable(res: Response, defecto: string): Promise<Entregable> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  let advertencias: string[] = [];
  try {
    advertencias = JSON.parse(decodeURIComponent(res.headers.get("x-advertencias") ?? "[]"));
  } catch {
    advertencias = [];
  }
  return {
    bytes,
    fileName: decodeURIComponent(res.headers.get("x-nombre-archivo") ?? `informe.${defecto}`),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    advertencias,
  };
}
