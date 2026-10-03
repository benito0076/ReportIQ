import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import type { ReportKind } from "@/db/enums";
import { equipment, reports } from "@/db/schema";
import * as engine from "@/lib/engine";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteObject, downloadUrl, newKey, putObject } from "@/lib/storage";
import type { ResultadosProyecto } from "@/lib/engine-types";
import { informePayload } from "@/lib/informe";
import { getProject, isUuid, listBarrido, listMemoryFiles, listPoints, saveResults } from "./projects";
import { firmasInforme, getSettings } from "./settings";

// Las URLs firmadas que recibe el motor deben durar lo que dure el trabajo.
const ENGINE_URL_TTL = 15 * 60;

/** Arma el proyecto para el motor, con URLs firmadas para memorias y fotos. */
export async function buildPayload(projectId: string, userId?: string): Promise<engine.ProyectoPayload> {
  const [project, pts, mems, firmas, barrido] = await Promise.all([
    getProject(projectId),
    listPoints(projectId),
    listMemoryFiles(projectId),
    firmasInforme(userId),
    listBarrido(projectId),
  ]);
  if (project.tipo === "aire" || project.tipo === "vertimientos") {
    throw new ValidationError("Este proyecto se procesa desde su propia página.");
  }
  if (pts.length === 0) throw new ValidationError("Agregue al menos un punto de monitoreo.");
  if (mems.length === 0) throw new ValidationError("Suba al menos una memoria del sonómetro.");

  const puntos = await Promise.all(
    pts.map(async (p) => {
      const memorias: engine.PuntoPayload["memorias"] = {};
      for (const m of mems.filter((m) => m.pointId === p.id)) {
        (memorias[m.esquema] ??= {})[m.direccion] = {
          url: await downloadUrl(m.fileKey, { ttl: ENGINE_URL_TTL }),
          nombre: m.fileName,
        };
      }
      return {
        no_punto: p.orden,
        nombre: p.nombre,
        sector: p.sector,
        este: p.este,
        norte: p.norte,
        incertidumbre: p.incertidumbre,
        altitud: p.altitud,
        descripcion: p.descripcion,
        fuentes: p.fuentes,
        foto: p.fotoKey
          ? { url: await downloadUrl(p.fotoKey, { ttl: ENGINE_URL_TTL }), nombre: p.fotoNombre ?? "foto.jpg" }
          : null,
        memorias,
      };
    }),
  );
  return {
    tipo: project.tipo === "emision" ? "emision" : "ambiental",
    barrido: await Promise.all(
      project.tipo === "emision"
        ? barrido.map(async (b) => ({
            nombre: b.nombre,
            condicion: b.condicion,
            seleccionado: b.seleccionado,
            archivo: { url: await downloadUrl(b.fileKey, { ttl: ENGINE_URL_TTL }), nombre: b.fileName },
          }))
        : [],
    ),
    nombre_proyecto: project.nombre,
    codigo_informe: project.codigoInforme,
    cliente: project.cliente,
    puntos,
    informe: informePayload(project.informe, firmas),
    meteorologia: project.meteoKey
      ? { url: await downloadUrl(project.meteoKey, { ttl: ENGINE_URL_TTL }), nombre: project.meteoNombre ?? "meteorologia.xlsx" }
      : null,
  };
}

export async function processProject(projectId: string): Promise<ResultadosProyecto> {
  const resultados = await engine.procesar(await buildPayload(projectId));
  await saveResults(projectId, resultados);
  return resultados;
}

export async function generateReport(projectId: string, kind: ReportKind, userId: string) {
  const [proyecto, settings, equipos] = await Promise.all([
    buildPayload(projectId, userId),
    getSettings(),
    db.select({ nombre: equipment.nombre, codigo: equipment.codigo, serial: equipment.serial }).from(equipment),
  ]);
  // La plantilla propia de Ajustes es la de ruido ambiental; emisión usa la incluida.
  const plantilla =
    kind === "word" && proyecto.tipo === "ambiental" && settings.plantillaKey
      ? { url: await downloadUrl(settings.plantillaKey, { ttl: ENGINE_URL_TTL }), nombre: settings.plantillaNombre ?? "plantilla.docx" }
      : null;

  const result = await engine.generar({
    proyecto,
    tipo: kind,
    plantilla,
    equipos,
    elaborado_por: settings.elaboradoPor,
  });

  const ext = kind === "word" ? "docx" : kind === "excel" ? "xlsx" : "zip";
  const key = newKey("informe", projectId, ext);
  await putObject(key, result.bytes, result.contentType);
  const [row] = await db
    .insert(reports)
    .values({
      projectId,
      kind,
      fileKey: key,
      fileName: result.fileName,
      size: result.bytes.byteLength,
      advertencias: result.advertencias,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function listReports(projectId: string) {
  return db.select().from(reports).where(eq(reports.projectId, projectId)).orderBy(desc(reports.createdAt));
}

async function getReport(projectId: string, reportId: string) {
  if (!isUuid(reportId)) throw new NotFoundError("El archivo no existe.");
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("El archivo no existe.");
  return row;
}

export async function reportDownloadUrl(projectId: string, reportId: string) {
  const row = await getReport(projectId, reportId);
  return { url: await downloadUrl(row.fileKey, { fileName: row.fileName }), fileName: row.fileName };
}

/** Elimina un entregable del historial; devuelve su nombre de archivo. */
export async function deleteReport(projectId: string, reportId: string) {
  const row = await getReport(projectId, reportId);
  await db.delete(reports).where(eq(reports.id, reportId));
  await deleteObject(row.fileKey);
  return row.fileName;
}
