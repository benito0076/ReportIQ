import "server-only";
import { z } from "zod";
import { DIRECCIONES, DIRECCIONES_Y_RANURAS, ESQUEMAS, PLANTILLAS_AIRE, RANURAS_EMISION } from "@/db/enums";
import { CONTENT_TYPES, UPLOAD_RULES, extensionFor, matchesRule, sniff } from "@/lib/files";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/session";
import {
  deleteObject,
  keyBelongsTo,
  newKey,
  objectSize,
  readHead,
  sanitizeFileName,
  uploadUrl,
} from "@/lib/storage";
import { addBarrido, getPoint, getProject, setMemoryFile, setPointPhoto, setProjectMeteo } from "./projects";
import { getAireProject, getStation, setAirFile, setStationPhoto } from "./aire";
import { assignLabReport, getVertProject, getWaterPoint, setFp004, setWaterPointFile } from "./vertimientos";
import { logActivity } from "./activity";
import { updateSettings } from "./settings";

/**
 * Subida directa del navegador al almacenamiento en dos pasos:
 *  1. prepareUpload: valida el destino y el tamaño declarado y entrega una
 *     URL firmada de subida para una clave nueva.
 *  2. confirmUpload: tras la subida, verifica el objeto real (tamaño y firma
 *     binaria) y lo asigna en la base de datos; si no es válido, lo borra.
 */

export const uploadTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("memoria"),
    projectId: z.uuid(),
    pointId: z.uuid(),
    esquema: z.enum(ESQUEMAS),
    direccion: z.enum(DIRECCIONES_Y_RANURAS),
  }),
  z.object({ kind: z.literal("barrido"), projectId: z.uuid() }),
  z.object({ kind: z.literal("foto"), projectId: z.uuid(), pointId: z.uuid() }),
  z.object({ kind: z.literal("meteo"), projectId: z.uuid() }),
  z.object({ kind: z.literal("aire"), projectId: z.uuid(), plantilla: z.enum(PLANTILLAS_AIRE) }),
  z.object({ kind: z.literal("fotoAire"), projectId: z.uuid(), stationId: z.uuid() }),
  z.object({ kind: z.literal("laboratorio"), projectId: z.uuid(), pointId: z.uuid() }),
  z.object({ kind: z.literal("fp004"), projectId: z.uuid() }),
  z.object({ kind: z.literal("laboratorioLote"), projectId: z.uuid() }),
  z.object({ kind: z.literal("fotoAgua"), projectId: z.uuid(), pointId: z.uuid() }),
  z.object({ kind: z.literal("plantilla") }),
]);
export type UploadTarget = z.infer<typeof uploadTargetSchema>;

function scopeOf(target: UploadTarget): string {
  return target.kind === "plantilla" ? "empresa" : target.projectId;
}

async function checkTarget(target: UploadTarget, user: CurrentUser) {
  if (target.kind === "plantilla") {
    if (user.role !== "admin") throw new ForbiddenError();
    return;
  }
  if (target.kind === "meteo") {
    const project = await getProject(target.projectId);
    // Calidad del aire está en desarrollo: solo el administrador.
    if ((project.tipo === "aire" || project.tipo === "vertimientos") && user.role !== "admin") throw new ForbiddenError();
    return;
  }
  if (target.kind === "aire") {
    if (user.role !== "admin") throw new ForbiddenError();
    await getAireProject(target.projectId);
    return;
  }
  if (target.kind === "fotoAire") {
    if (user.role !== "admin") throw new ForbiddenError();
    await getStation(target.projectId, target.stationId);
    return;
  }
  if (target.kind === "laboratorio" || target.kind === "fotoAgua") {
    // Vertimientos está en desarrollo: solo el administrador.
    if (user.role !== "admin") throw new ForbiddenError();
    await getWaterPoint(target.projectId, target.pointId);
    return;
  }
  if (target.kind === "fp004" || target.kind === "laboratorioLote") {
    if (user.role !== "admin") throw new ForbiddenError();
    await getVertProject(target.projectId);
    return;
  }
  if (target.kind === "barrido") {
    const project = await getProject(target.projectId);
    if (project.tipo !== "emision") throw new ValidationError("El barrido solo aplica a proyectos de emisión.");
    return;
  }
  await getPoint(target.projectId, target.pointId);
  if (target.kind === "memoria") {
    // Ambiental usa las 5 direcciones; emisión, la medición y el residual.
    const project = await getProject(target.projectId);
    const validas: readonly string[] = project.tipo === "emision" ? RANURAS_EMISION : DIRECCIONES;
    if (!validas.includes(target.direccion)) throw new ValidationError("Casilla de memoria inválida para este proyecto.");
  }
}

export async function prepareUpload(target: UploadTarget, fileName: string, size: number, user: CurrentUser) {
  await checkTarget(target, user);
  const rule = UPLOAD_RULES[target.kind];
  if (!Number.isFinite(size) || size <= 0) throw new ValidationError("El archivo está vacío.");
  if (size > rule.maxBytes) {
    throw new ValidationError(`El archivo supera el tamaño máximo (${rule.maxBytes / 1024 / 1024} MB).`);
  }
  const ext = extensionFor(target.kind, fileName);
  const key = newKey(target.kind, scopeOf(target), ext);
  const contentType = CONTENT_TYPES[ext as keyof typeof CONTENT_TYPES];
  return { key, url: await uploadUrl(key, contentType), contentType };
}

/** Verifica y asigna el archivo subido. Devuelve un mensaje para el usuario (subidas por lote). */
export async function confirmUpload(
  target: UploadTarget,
  key: string,
  fileName: string,
  user: CurrentUser,
): Promise<{ mensaje?: string }> {
  await checkTarget(target, user);
  if (!keyBelongsTo(key, target.kind, scopeOf(target))) throw new ValidationError("Clave de archivo inválida.");
  const rule = UPLOAD_RULES[target.kind];
  const size = await objectSize(key);
  if (size === null) throw new ValidationError("El archivo no llegó al almacenamiento. Intente de nuevo.");
  if (size === 0 || size > rule.maxBytes || !matchesRule(sniff(await readHead(key)), rule)) {
    await deleteObject(key);
    throw new ValidationError(`El archivo no es una ${rule.label} válida.`);
  }
  const name = sanitizeFileName(fileName, `archivo.${key.split(".").pop()}`);

  switch (target.kind) {
    case "memoria":
      await setMemoryFile(target.projectId, target.pointId, target.esquema, target.direccion, {
        key,
        fileName: name,
        size,
      });
      break;
    case "foto":
      await setPointPhoto(target.projectId, target.pointId, key, name);
      break;
    case "meteo":
      await setProjectMeteo(target.projectId, key, name);
      break;
    case "barrido":
      await addBarrido(target.projectId, { key, fileName: name, size });
      break;
    case "aire":
      await setAirFile(target.projectId, target.plantilla, { key, fileName: name, size });
      break;
    case "fotoAire":
      await setStationPhoto(target.projectId, target.stationId, key, name);
      break;
    case "laboratorio":
      await setWaterPointFile(target.projectId, target.pointId, "informe", key, name);
      break;
    case "fotoAgua":
      await setWaterPointFile(target.projectId, target.pointId, "foto", key, name);
      break;
    case "fp004":
      await setFp004(target.projectId, key, name);
      break;
    case "laboratorioLote":
      return { mensaje: await assignLabReport(target.projectId, key, name) };
    case "plantilla":
      await updateSettings({ plantillaKey: key, plantillaNombre: name });
      await logActivity("plantilla_subida", user, name);
      break;
  }
  return {};
}
