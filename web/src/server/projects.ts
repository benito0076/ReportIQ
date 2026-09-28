import "server-only";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import type { Direccion, Esquema } from "@/db/enums";
import { memoryFiles, points, projects, reports, users } from "@/db/schema";
import type { PointInput, ProjectInput } from "@/lib/validation";
import { NotFoundError } from "@/lib/errors";
import { deleteObject } from "@/lib/storage";

export async function listProjects() {
  const nPoints = db
    .select({ projectId: points.projectId, n: count().as("n") })
    .from(points)
    .groupBy(points.projectId)
    .as("np");
  return db
    .select({
      id: projects.id,
      nombre: projects.nombre,
      cliente: projects.cliente,
      codigoInforme: projects.codigoInforme,
      updatedAt: projects.updatedAt,
      procesadoAt: projects.procesadoAt,
      puntos: nPoints.n,
      creadoPor: users.fullName,
      creadoPorEmail: users.email,
    })
    .from(projects)
    .leftJoin(nPoints, eq(nPoints.projectId, projects.id))
    .leftJoin(users, eq(users.id, projects.createdBy))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(id: string) {
  if (!isUuid(id)) throw new NotFoundError("El proyecto no existe.");
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!row) throw new NotFoundError("El proyecto no existe.");
  return row;
}

export async function createProject(input: ProjectInput, userId: string) {
  const [row] = await db
    .insert(projects)
    .values({ ...input, createdBy: userId })
    .returning({ id: projects.id });
  return row.id;
}

export async function updateProject(id: string, input: ProjectInput) {
  await getProject(id);
  // Nombre, cliente y código no afectan los cálculos: los resultados se conservan.
  await db.update(projects).set(input).where(eq(projects.id, id));
}

/** Borra el proyecto y todos sus archivos en el almacenamiento. */
export async function deleteProject(id: string) {
  await getProject(id);
  const keys = await projectFileKeys(id);
  await db.delete(projects).where(eq(projects.id, id));
  await Promise.all(keys.map((k) => deleteObject(k)));
}

async function projectFileKeys(projectId: string): Promise<string[]> {
  const pts = await db.select({ id: points.id, foto: points.fotoKey }).from(points).where(eq(points.projectId, projectId));
  const ids = pts.map((p) => p.id);
  const mems = ids.length
    ? await db.select({ key: memoryFiles.fileKey }).from(memoryFiles).where(inArray(memoryFiles.pointId, ids))
    : [];
  const reps = await db.select({ key: reports.fileKey }).from(reports).where(eq(reports.projectId, projectId));
  const [proj] = await db.select({ meteo: projects.meteoKey }).from(projects).where(eq(projects.id, projectId));
  return [proj?.meteo, ...pts.map((p) => p.foto), ...mems.map((m) => m.key), ...reps.map((r) => r.key)].filter(
    (k): k is string => !!k,
  );
}

/** Los resultados guardados dejan de ser válidos cuando cambian los datos. */
export async function invalidateResults(projectId: string, tx: DbOrTx = db) {
  await tx.update(projects).set({ resultados: null, procesadoAt: null }).where(eq(projects.id, projectId));
}

/**
 * Asigna (o quita, con key = null) el archivo de la estación meteorológica.
 * No afecta los niveles de ruido, así que los resultados se conservan.
 */
export async function setProjectMeteo(projectId: string, key: string | null, fileName: string | null) {
  const project = await getProject(projectId);
  await db.update(projects).set({ meteoKey: key, meteoNombre: fileName }).where(eq(projects.id, projectId));
  if (project.meteoKey && project.meteoKey !== key) await deleteObject(project.meteoKey);
}

// ----------------------------------------------------------------- puntos
export async function listPoints(projectId: string) {
  return db.select().from(points).where(eq(points.projectId, projectId)).orderBy(asc(points.orden));
}

export async function getPoint(projectId: string, pointId: string) {
  if (!isUuid(pointId)) throw new NotFoundError("El punto no existe.");
  const [row] = await db
    .select()
    .from(points)
    .where(and(eq(points.id, pointId), eq(points.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("El punto no existe.");
  return row;
}

export async function createPoint(projectId: string, input: PointInput) {
  await getProject(projectId);
  return db.transaction(async (tx) => {
    const [{ m }] = await tx.select({ m: max(points.orden) }).from(points).where(eq(points.projectId, projectId));
    const [row] = await tx
      .insert(points)
      .values({ ...input, projectId, orden: (m ?? 0) + 1 })
      .returning({ id: points.id });
    await invalidateResults(projectId, tx);
    return row.id;
  });
}

export async function updatePoint(projectId: string, pointId: string, input: PointInput) {
  await getPoint(projectId, pointId);
  await db.transaction(async (tx) => {
    await tx.update(points).set(input).where(eq(points.id, pointId));
    await invalidateResults(projectId, tx);
  });
}

export async function setPointPhoto(projectId: string, pointId: string, key: string | null, fileName: string | null) {
  const point = await getPoint(projectId, pointId);
  await db.transaction(async (tx) => {
    await tx.update(points).set({ fotoKey: key, fotoNombre: fileName }).where(eq(points.id, pointId));
    await invalidateResults(projectId, tx);
  });
  if (point.fotoKey && point.fotoKey !== key) await deleteObject(point.fotoKey);
}

/** Elimina el punto y renumera los siguientes (el número aparece en el informe). */
export async function deletePoint(projectId: string, pointId: string) {
  const point = await getPoint(projectId, pointId);
  const mems = await db.select({ key: memoryFiles.fileKey }).from(memoryFiles).where(eq(memoryFiles.pointId, pointId));
  await db.transaction(async (tx) => {
    await tx.delete(points).where(eq(points.id, pointId));
    const rest = await tx
      .select({ id: points.id })
      .from(points)
      .where(eq(points.projectId, projectId))
      .orderBy(asc(points.orden));
    for (const [i, p] of rest.entries()) {
      await tx.update(points).set({ orden: i + 1 }).where(eq(points.id, p.id));
    }
    await invalidateResults(projectId, tx);
  });
  await Promise.all([point.fotoKey, ...mems.map((m) => m.key)].map((k) => deleteObject(k)));
}

/** Mueve un punto una posición arriba o abajo. */
export async function movePoint(projectId: string, pointId: string, delta: -1 | 1) {
  const all = await listPoints(projectId);
  const i = all.findIndex((p) => p.id === pointId);
  const j = i + delta;
  if (i < 0) throw new NotFoundError("El punto no existe.");
  if (j < 0 || j >= all.length) return;
  await db.transaction(async (tx) => {
    await tx.update(points).set({ orden: all[j].orden }).where(eq(points.id, all[i].id));
    await tx.update(points).set({ orden: all[i].orden }).where(eq(points.id, all[j].id));
    await invalidateResults(projectId, tx);
  });
}

// ---------------------------------------------------------------- memorias
export async function listMemoryFiles(projectId: string) {
  return db
    .select({
      id: memoryFiles.id,
      pointId: memoryFiles.pointId,
      esquema: memoryFiles.esquema,
      direccion: memoryFiles.direccion,
      fileKey: memoryFiles.fileKey,
      fileName: memoryFiles.fileName,
      size: memoryFiles.size,
      uploadedAt: memoryFiles.uploadedAt,
    })
    .from(memoryFiles)
    .innerJoin(points, eq(points.id, memoryFiles.pointId))
    .where(eq(points.projectId, projectId));
}

export async function getMemoryFile(projectId: string, fileId: string) {
  if (!isUuid(fileId)) throw new NotFoundError("El archivo no existe.");
  const [row] = await db
    .select({ id: memoryFiles.id, fileKey: memoryFiles.fileKey, fileName: memoryFiles.fileName })
    .from(memoryFiles)
    .innerJoin(points, eq(points.id, memoryFiles.pointId))
    .where(and(eq(memoryFiles.id, fileId), eq(points.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("El archivo no existe.");
  return row;
}

/** Asigna (o reemplaza) la memoria de un punto / esquema / dirección. */
export async function setMemoryFile(
  projectId: string,
  pointId: string,
  esquema: Esquema,
  direccion: Direccion,
  file: { key: string; fileName: string; size: number },
) {
  await getPoint(projectId, pointId);
  const previous = await db
    .select({ key: memoryFiles.fileKey })
    .from(memoryFiles)
    .where(and(eq(memoryFiles.pointId, pointId), eq(memoryFiles.esquema, esquema), eq(memoryFiles.direccion, direccion)));
  await db.transaction(async (tx) => {
    await tx
      .insert(memoryFiles)
      .values({ pointId, esquema, direccion, fileKey: file.key, fileName: file.fileName, size: file.size })
      .onConflictDoUpdate({
        target: [memoryFiles.pointId, memoryFiles.esquema, memoryFiles.direccion],
        set: { fileKey: file.key, fileName: file.fileName, size: file.size, uploadedAt: new Date() },
      });
    await invalidateResults(projectId, tx);
  });
  await Promise.all(previous.filter((p) => p.key !== file.key).map((p) => deleteObject(p.key)));
}

export async function removeMemoryFile(projectId: string, fileId: string) {
  const file = await getMemoryFile(projectId, fileId);
  await db.transaction(async (tx) => {
    await tx.delete(memoryFiles).where(eq(memoryFiles.id, fileId));
    await invalidateResults(projectId, tx);
  });
  await deleteObject(file.fileKey);
}

export async function saveResults(projectId: string, resultados: NonNullable<typeof projects.$inferSelect.resultados>) {
  await db.update(projects).set({ resultados, procesadoAt: new Date() }).where(eq(projects.id, projectId));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
