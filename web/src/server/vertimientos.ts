import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { projects, reports, users, waterPoints, type ConfigVertimiento } from "@/db/schema";
import * as engine from "@/lib/engine";
import type { ResultadosVertimiento } from "@/lib/engine-types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { informePayload } from "@/lib/informe";
import { deleteObject, downloadUrl, newKey, putObject } from "@/lib/storage";
import type { ConfigVertimientoInput, ProjectInput, WaterPointInput } from "@/lib/validation";
import { getProject, isUuid } from "./projects";
import { getSettings } from "./settings";

/**
 * Proyectos de vertimientos (matriz agua, Res. 0631 de 2015). Mientras el
 * módulo está en desarrollo, todas las operaciones son solo para
 * administradores (las acciones y rutas lo verifican con assertAdmin).
 */

const ENGINE_URL_TTL = 15 * 60;

export async function listVertProjects() {
  const nPts = db
    .select({ projectId: waterPoints.projectId, n: count().as("n") })
    .from(waterPoints)
    .groupBy(waterPoints.projectId)
    .as("np");
  return db
    .select({
      id: projects.id,
      nombre: projects.nombre,
      cliente: projects.cliente,
      codigoInforme: projects.codigoInforme,
      updatedAt: projects.updatedAt,
      procesadoAt: projects.procesadoAt,
      puntos: nPts.n,
      creadoPor: users.fullName,
    })
    .from(projects)
    .leftJoin(nPts, eq(nPts.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(eq(projects.tipo, "vertimientos"))
    .orderBy(desc(projects.updatedAt));
}

export async function getVertProject(id: string) {
  const project = await getProject(id);
  if (project.tipo !== "vertimientos") throw new NotFoundError("El proyecto no existe.");
  return project;
}

export async function createVertProject(input: ProjectInput, userId: string) {
  const [row] = await db
    .insert(projects)
    .values({ ...input, tipo: "vertimientos", createdBy: userId })
    .returning({ id: projects.id });
  return row.id;
}

export function configDe(project: { vertimiento: Partial<ConfigVertimiento> }): ConfigVertimiento {
  return {
    actividades: project.vertimiento.actividades ?? [],
    alcantarillado: project.vertimiento.alcantarillado ?? false,
    consumoHumano: project.vertimiento.consumoHumano ?? false,
  };
}

export async function invalidateVert(projectId: string, tx: DbOrTx = db) {
  await tx.update(projects).set({ resultadosVertimiento: null, procesadoAt: null }).where(eq(projects.id, projectId));
}

export async function setConfigVertimiento(projectId: string, config: ConfigVertimientoInput) {
  await getVertProject(projectId);
  await db
    .update(projects)
    .set({ vertimiento: config, resultadosVertimiento: null, procesadoAt: null })
    .where(eq(projects.id, projectId));
}

// ------------------------------------------------------------------ puntos
export async function listWaterPoints(projectId: string) {
  return db
    .select()
    .from(waterPoints)
    .where(eq(waterPoints.projectId, projectId))
    .orderBy(asc(waterPoints.orden), asc(waterPoints.createdAt));
}

export async function getWaterPoint(projectId: string, pointId: string) {
  if (!isUuid(pointId)) throw new NotFoundError("El punto no existe.");
  const [row] = await db
    .select()
    .from(waterPoints)
    .where(and(eq(waterPoints.id, pointId), eq(waterPoints.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("El punto no existe.");
  return row;
}

export async function createWaterPoint(projectId: string, input: WaterPointInput) {
  await getVertProject(projectId);
  const existentes = await listWaterPoints(projectId);
  if (existentes.some((p) => p.nombre.trim().toLowerCase() === input.nombre.trim().toLowerCase())) {
    throw new ValidationError(`Ya existe el punto «${input.nombre}» en este proyecto.`);
  }
  const orden = Math.max(0, ...existentes.map((p) => p.orden)) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(waterPoints).values({ ...input, projectId, orden });
    await invalidateVert(projectId, tx);
  });
}

export async function updateWaterPoint(projectId: string, pointId: string, input: WaterPointInput) {
  await getWaterPoint(projectId, pointId);
  const otros = (await listWaterPoints(projectId)).filter((p) => p.id !== pointId);
  if (otros.some((p) => p.nombre.trim().toLowerCase() === input.nombre.trim().toLowerCase())) {
    throw new ValidationError(`Ya existe el punto «${input.nombre}» en este proyecto.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(waterPoints).set(input).where(eq(waterPoints.id, pointId));
    await invalidateVert(projectId, tx);
  });
}

export async function deleteWaterPoint(projectId: string, pointId: string) {
  const point = await getWaterPoint(projectId, pointId);
  await db.transaction(async (tx) => {
    await tx.delete(waterPoints).where(eq(waterPoints.id, pointId));
    await invalidateVert(projectId, tx);
  });
  await Promise.all([deleteObject(point.informeKey), deleteObject(point.fotoKey)]);
}

type ArchivoPunto = "informe" | "foto";

/** Reporte del laboratorio (PDF) o foto del punto. */
export async function setWaterPointFile(
  projectId: string,
  pointId: string,
  archivo: ArchivoPunto,
  key: string,
  fileName: string,
) {
  const point = await getWaterPoint(projectId, pointId);
  const anterior = archivo === "informe" ? point.informeKey : point.fotoKey;
  await db.transaction(async (tx) => {
    await tx
      .update(waterPoints)
      .set(archivo === "informe" ? { informeKey: key, informeNombre: fileName } : { fotoKey: key, fotoNombre: fileName })
      .where(eq(waterPoints.id, pointId));
    // La foto es solo para el informe; el reporte cambia los resultados.
    if (archivo === "informe") await invalidateVert(projectId, tx);
  });
  if (anterior && anterior !== key) await deleteObject(anterior);
}

export async function removeWaterPointFile(projectId: string, pointId: string, archivo: ArchivoPunto) {
  const point = await getWaterPoint(projectId, pointId);
  const key = archivo === "informe" ? point.informeKey : point.fotoKey;
  if (!key) return;
  await db.transaction(async (tx) => {
    await tx
      .update(waterPoints)
      .set(archivo === "informe" ? { informeKey: null, informeNombre: null } : { fotoKey: null, fotoNombre: null })
      .where(eq(waterPoints.id, pointId));
    if (archivo === "informe") await invalidateVert(projectId, tx);
  });
  await deleteObject(key);
}

// ------------------------------------------------------------------ FP-004
export async function setFp004(projectId: string, key: string, fileName: string) {
  const project = await getVertProject(projectId);
  await db
    .update(projects)
    .set({ fp004Key: key, fp004Nombre: fileName, resultadosVertimiento: null, procesadoAt: null })
    .where(eq(projects.id, projectId));
  if (project.fp004Key && project.fp004Key !== key) await deleteObject(project.fp004Key);
}

export async function removeFp004(projectId: string) {
  const project = await getVertProject(projectId);
  if (!project.fp004Key) return;
  await db
    .update(projects)
    .set({ fp004Key: null, fp004Nombre: null, resultadosVertimiento: null, procesadoAt: null })
    .where(eq(projects.id, projectId));
  await deleteObject(project.fp004Key);
}

// ------------------------------------------------------------ procesamiento
async function buildPayload(projectId: string): Promise<engine.ProyectoVertimientoPayload> {
  const [project, puntos, settings] = await Promise.all([
    getVertProject(projectId),
    listWaterPoints(projectId),
    getSettings(),
  ]);
  if (puntos.length === 0) throw new ValidationError("Agregue al menos un punto de muestreo.");
  if (!puntos.some((p) => p.informeKey)) {
    throw new ValidationError("Suba el reporte de resultados del laboratorio (PDF) de al menos un punto.");
  }
  const config = configDe(project);
  const url = (key: string) => downloadUrl(key, { ttl: ENGINE_URL_TTL });
  return {
    nombre_proyecto: project.nombre,
    codigo: project.codigoInforme,
    cliente: project.cliente,
    puntos: await Promise.all(
      puntos.map(async (p) => ({
        nombre: p.nombre,
        informe: p.informeKey ? { url: await url(p.informeKey), nombre: p.informeNombre ?? "reporte.pdf" } : null,
        hoja_fp: p.hojaFp,
        evaluar: p.evaluar,
        latitud: p.latitud,
        longitud: p.longitud,
        descripcion: p.descripcion,
        tipo_agua: p.tipoAgua,
        foto: p.fotoKey ? { url: await url(p.fotoKey), nombre: p.fotoNombre ?? "foto.jpg" } : null,
      })),
    ),
    fp004: project.fp004Key ? { url: await url(project.fp004Key), nombre: project.fp004Nombre ?? "FP-004.xlsx" } : null,
    actividades: config.actividades,
    alcantarillado: config.alcantarillado,
    consumo_humano: config.consumoHumano,
    informe: informePayload(project.informe, {
      elaboroNombre: settings.elaboroNombre,
      elaboroCargo: settings.elaboroCargo,
      autorizoNombre: settings.autorizoNombre,
      autorizoCargo: settings.autorizoCargo,
    }),
  };
}

export async function processVertimiento(projectId: string): Promise<ResultadosVertimiento> {
  const resultados = await engine.procesarVertimiento(await buildPayload(projectId));
  await db
    .update(projects)
    .set({ resultadosVertimiento: resultados, procesadoAt: new Date() })
    .where(eq(projects.id, projectId));
  return resultados;
}

export async function generateVertReport(projectId: string, userId: string) {
  const result = await engine.generarVertimiento(await buildPayload(projectId), "excel");
  const key = newKey("informe", projectId, "xlsx");
  await putObject(key, result.bytes, result.contentType);
  const [row] = await db
    .insert(reports)
    .values({
      projectId,
      kind: "excel",
      fileKey: key,
      fileName: result.fileName,
      size: result.bytes.byteLength,
      advertencias: result.advertencias,
      createdBy: userId,
    })
    .returning();
  return row;
}
