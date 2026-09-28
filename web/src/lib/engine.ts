import "server-only";
import type { ReportKind } from "@/db/enums";
import type { ResultadosProyecto } from "./engine-types";
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
  foto: ArchivoRemoto | null;
  memorias: Record<string, Record<string, ArchivoRemoto>>;
}

export interface ProyectoPayload {
  nombre_proyecto: string;
  codigo_informe: string;
  cliente: string;
  puntos: PuntoPayload[];
  meteorologia: ArchivoRemoto | null;
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

async function call(path: string, body: unknown): Promise<Response> {
  const { url, key } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch {
      // cuerpo no JSON
    }
    if (res.status === 422 && detail) throw new EngineError(detail, 422);
    if (res.status === 502 && detail) throw new EngineError(detail, 502);
    if (res.status === 401) throw new EngineError("La clave del motor de cálculo (ENGINE_API_KEY) no coincide.", 502);
    throw new EngineError(`El motor de cálculo respondió con un error (HTTP ${res.status}).`, 502);
  }
  return res;
}

export async function procesar(proyecto: ProyectoPayload): Promise<ResultadosProyecto> {
  const res = await call("/v1/procesar", { proyecto });
  return (await res.json()) as ResultadosProyecto;
}

export async function generar(payload: GenerarPayload): Promise<Entregable> {
  const res = await call("/v1/generar", payload);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let advertencias: string[] = [];
  try {
    advertencias = JSON.parse(decodeURIComponent(res.headers.get("x-advertencias") ?? "[]"));
  } catch {
    advertencias = [];
  }
  return {
    bytes,
    fileName: decodeURIComponent(res.headers.get("x-nombre-archivo") ?? `informe.${payload.tipo}`),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    advertencias,
  };
}
