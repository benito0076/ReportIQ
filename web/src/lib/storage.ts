import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Almacenamiento de archivos (memorias, fotos, plantillas, datos
 * meteorológicos e informes).
 *  - El bucket es privado: todo se sirve con URLs firmadas de corta duración.
 *  - El navegador sube los archivos directamente al bucket con una URL
 *    firmada de subida (PUT), sin pasar por el servidor: así no aplica el
 *    límite de tamaño de las funciones de Vercel (4,5 MB).
 *  - El motor Python descarga los archivos con URLs firmadas de lectura.
 *  - STORAGE_DRIVER=local guarda en .uploads/ (solo desarrollo); las URLs
 *    firmadas apuntan entonces a /api/local-files, protegidas con HMAC.
 */

export type FileKind =
  | "memoria"
  | "foto"
  | "plantilla"
  | "meteo"
  | "barrido"
  | "aire"
  | "fotoAire"
  | "laboratorio"
  | "fp004"
  | "fotoAgua"
  | "informe";

const PREFIX: Record<FileKind, string> = {
  memoria: "memorias",
  foto: "fotos",
  plantilla: "plantillas",
  meteo: "meteorologia",
  barrido: "barrido",
  aire: "aire",
  fotoAire: "fotos",
  laboratorio: "vertimientos",
  fp004: "vertimientos",
  fotoAgua: "fotos",
  informe: "informes",
};

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export function isLocalStorage(): boolean {
  return process.env.STORAGE_DRIVER === "local";
}

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return s3;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET no está definida");
  return b;
}

/** Clave nueva e inadivinable; el nombre original nunca forma parte de la clave. */
export function newKey(kind: FileKind, scope: string, ext: string): string {
  return `${PREFIX[kind]}/${scope}/${randomUUID()}.${ext}`;
}

/** Comprueba que una clave enviada por el cliente pertenece al ámbito esperado. */
export function keyBelongsTo(key: string, kind: FileKind, scope: string): boolean {
  const re = new RegExp(`^${PREFIX[kind]}/${scope}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`);
  return re.test(key);
}

// ------------------------------------------------------------- URLs locales
function localSignature(op: "get" | "put", key: string, exp: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está definida");
  return createHmac("sha256", secret).update(`${op}\n${key}\n${exp}`).digest("hex");
}

export function verifyLocalSignature(op: "get" | "put", key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(localSignature(op, key, exp));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function localUrl(op: "get" | "put", key: string, ttl: number, fileName?: string): string {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({ exp: String(exp), sig: localSignature(op, key, exp) });
  if (fileName) params.set("name", fileName);
  return `${base}/api/local-files/${key}?${params}`;
}

export function resolveLocalPath(key: string): string {
  const resolved = path.resolve(LOCAL_DIR, key);
  if (!resolved.startsWith(LOCAL_DIR + path.sep)) throw new Error("Clave inválida");
  return resolved;
}

// ---------------------------------------------------------------- operaciones
export async function uploadUrl(key: string, contentType: string, ttl = 600): Promise<string> {
  if (isLocalStorage()) return localUrl("put", key, ttl);
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: ttl,
  });
}

/**
 * URL firmada de lectura. `fileName` fuerza la descarga con ese nombre
 * (Content-Disposition); sin él, el archivo se sirve tal cual (motor).
 */
export async function downloadUrl(key: string, opts: { fileName?: string; ttl?: number } = {}): Promise<string> {
  const ttl = opts.ttl ?? 300;
  if (isLocalStorage()) return localUrl("get", key, ttl, opts.fileName);
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts.fileName ? contentDisposition(opts.fileName) : undefined,
    }),
    { expiresIn: ttl },
  );
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (isLocalStorage()) {
    const target = resolveLocalPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

/** Tamaño del objeto, o null si no existe. */
export async function objectSize(key: string): Promise<number | null> {
  if (isLocalStorage()) {
    const info = await stat(resolveLocalPath(key)).catch(() => null);
    return info ? info.size : null;
  }
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** Primeros bytes del objeto (para verificar la firma binaria del archivo). */
export async function readHead(key: string, bytes = 16): Promise<Uint8Array> {
  if (isLocalStorage()) {
    const data = await readFile(resolveLocalPath(key));
    return new Uint8Array(data.subarray(0, bytes));
  }
  const res = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${bytes - 1}` }),
  );
  return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
}

export async function deleteObject(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    if (isLocalStorage()) {
      await unlink(resolveLocalPath(key));
      return;
    }
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch {
    // Un archivo huérfano no debe impedir la operación principal.
  }
}

export function contentDisposition(fileName: string): string {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/\x00-\x1f"]/g, "_").trim();
  return (cleaned || fallback).slice(0, 200);
}
