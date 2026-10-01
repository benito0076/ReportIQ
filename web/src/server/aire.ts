import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import type { PlantillaAire } from "@/db/enums";
import { airFiles, airStations, projects, reports, users, type Project } from "@/db/schema";
import * as engine from "@/lib/engine";
import type { ResultadosAire } from "@/lib/engine-types";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import type { CurrentUser } from "@/lib/session";
import { deleteObject, downloadUrl, newKey, putObject } from "@/lib/storage";
import type { AirStationInput, ProjectInput } from "@/lib/validation";
import { getProject, isUuid } from "./projects";

/**
 * Proyectos de calidad del aire (Res. 2254 de 2017). Mientras el módulo está
 * en desarrollo, todas las operaciones son solo para administradores (las
 * acciones y rutas lo verifican con assertAdmin).
 */

const ENGINE_URL_TTL = 15 * 60;

export async function listAireProjects() {
  const nEst = db
    .select({ projectId: airStations.projectId, n: count().as("n") })
    .from(airStations)
    .groupBy(airStations.projectId)
    .as("ne");
  return db
    .select({
      id: projects.id,
      nombre: projects.nombre,
      cliente: projects.cliente,
      codigoInforme: projects.codigoInforme,
      updatedAt: projects.updatedAt,
      procesadoAt: projects.procesadoAt,
      estaciones: nEst.n,
      creadoPor: users.fullName,
    })
    .from(projects)
    .leftJoin(nEst, eq(nEst.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(eq(projects.tipo, "aire"))
    .orderBy(desc(projects.updatedAt));
}

export async function getAireProject(id: string) {
  const project = await getProject(id);
  if (project.tipo !== "aire") throw new NotFoundError("El proyecto no existe.");
  return project;
}

/** Los proyectos de calidad del aire solo los ve el administrador (rutas compartidas). */
export function assertProjectAccess(project: Pick<Project, "tipo">, user: CurrentUser) {
  if (project.tipo === "aire" && user.role !== "admin") throw new NotFoundError("El proyecto no existe.");
}

export async function createAireProject(input: ProjectInput, userId: string) {
  const [row] = await db
    .insert(projects)
    .values({ ...input, tipo: "aire", createdBy: userId })
    .returning({ id: projects.id });
  return row.id;
}

export async function invalidateAire(projectId: string, tx: DbOrTx = db) {
  await tx.update(projects).set({ resultadosAire: null, procesadoAt: null }).where(eq(projects.id, projectId));
}

// --------------------------------------------------------------- estaciones
export async function listStations(projectId: string) {
  return db.select().from(airStations).where(eq(airStations.projectId, projectId)).orderBy(asc(airStations.numero));
}

async function getStation(projectId: string, stationId: string) {
  if (!isUuid(stationId)) throw new NotFoundError("La estación no existe.");
  const [row] = await db
    .select()
    .from(airStations)
    .where(and(eq(airStations.id, stationId), eq(airStations.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("La estación no existe.");
  return row;
}

function numeroRepetido(e: unknown, numero: number): never {
  if (isUniqueViolation(e)) {
    throw new ConflictError(`Ya existe la estación ${numero} en este proyecto.`);
  }
  throw e;
}

export async function createStation(projectId: string, input: AirStationInput) {
  await getAireProject(projectId);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(airStations).values({ ...input, projectId });
      await invalidateAire(projectId, tx);
    });
  } catch (e) {
    numeroRepetido(e, input.numero);
  }
}

export async function updateStation(projectId: string, stationId: string, input: AirStationInput) {
  await getStation(projectId, stationId);
  try {
    await db.transaction(async (tx) => {
      await tx.update(airStations).set(input).where(eq(airStations.id, stationId));
      await invalidateAire(projectId, tx);
    });
  } catch (e) {
    numeroRepetido(e, input.numero);
  }
}

export async function deleteStation(projectId: string, stationId: string) {
  await getStation(projectId, stationId);
  await db.transaction(async (tx) => {
    await tx.delete(airStations).where(eq(airStations.id, stationId));
    await invalidateAire(projectId, tx);
  });
}

// ---------------------------------------------------------------- plantillas
export async function listAirFiles(projectId: string) {
  return db.select().from(airFiles).where(eq(airFiles.projectId, projectId));
}

export async function getAirFile(projectId: string, plantilla: PlantillaAire) {
  const [row] = await db
    .select()
    .from(airFiles)
    .where(and(eq(airFiles.projectId, projectId), eq(airFiles.plantilla, plantilla)))
    .limit(1);
  if (!row) throw new NotFoundError("El archivo no existe.");
  return row;
}

/** Asigna (o reemplaza) la plantilla FP de un contaminante. */
export async function setAirFile(
  projectId: string,
  plantilla: PlantillaAire,
  file: { key: string; fileName: string; size: number },
) {
  await getAireProject(projectId);
  const previous = await db
    .select({ key: airFiles.fileKey })
    .from(airFiles)
    .where(and(eq(airFiles.projectId, projectId), eq(airFiles.plantilla, plantilla)));
  await db.transaction(async (tx) => {
    await tx
      .insert(airFiles)
      .values({ projectId, plantilla, fileKey: file.key, fileName: file.fileName, size: file.size })
      .onConflictDoUpdate({
        target: [airFiles.projectId, airFiles.plantilla],
        set: { fileKey: file.key, fileName: file.fileName, size: file.size, uploadedAt: new Date() },
      });
    await invalidateAire(projectId, tx);
  });
  await Promise.all(previous.filter((p) => p.key !== file.key).map((p) => deleteObject(p.key)));
}

export async function removeAirFile(projectId: string, plantilla: PlantillaAire) {
  const file = await getAirFile(projectId, plantilla);
  await db.transaction(async (tx) => {
    await tx.delete(airFiles).where(eq(airFiles.id, file.id));
    await invalidateAire(projectId, tx);
  });
  await deleteObject(file.fileKey);
}

// ------------------------------------------------------------ procesamiento
async function buildPayload(projectId: string): Promise<engine.ProyectoAirePayload> {
  const [project, estaciones, archivos] = await Promise.all([
    getAireProject(projectId),
    listStations(projectId),
    listAirFiles(projectId),
  ]);
  if (archivos.length === 0) throw new ValidationError("Suba al menos una plantilla de procesamiento (FP).");
  const plantillas: engine.ProyectoAirePayload["plantillas"] = {};
  for (const f of archivos) {
    plantillas[f.plantilla] = { url: await downloadUrl(f.fileKey, { ttl: ENGINE_URL_TTL }), nombre: f.fileName };
  }
  return {
    nombre_proyecto: project.nombre,
    codigo: project.codigoInforme,
    cliente: project.cliente,
    estaciones: estaciones.map((e) => ({
      numero: e.numero,
      nombre: e.nombre,
      codigo: e.codigo,
      codigo_anla: e.codigoAnla,
      longitud: e.longitud,
      latitud: e.latitud,
      descripcion: e.descripcion,
    })),
    plantillas,
    meteorologia: project.meteoKey
      ? { url: await downloadUrl(project.meteoKey, { ttl: ENGINE_URL_TTL }), nombre: project.meteoNombre ?? "meteorologia.xlsx" }
      : null,
  };
}

export async function processAire(projectId: string): Promise<ResultadosAire> {
  const resultados = await engine.procesarAire(await buildPayload(projectId));
  await db.update(projects).set({ resultadosAire: resultados, procesadoAt: new Date() }).where(eq(projects.id, projectId));
  return resultados;
}

export async function generateAireExcel(projectId: string, userId: string) {
  const result = await engine.generarAire(await buildPayload(projectId));
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
