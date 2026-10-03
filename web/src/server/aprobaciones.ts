import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { puedeAprobar, type ReportState } from "@/db/enums";
import { projects, reports, users } from "@/db/schema";
import * as engine from "@/lib/engine";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/session";
import { deleteObject, downloadUrl, newKey, putObject } from "@/lib/storage";
import { hrefProyecto, isUuid } from "./projects";

const ENGINE_URL_TTL = 15 * 60;

async function informeWord(projectId: string, reportId: string) {
  if (!isUuid(reportId)) throw new NotFoundError("El informe no existe.");
  const [row] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, reportId), eq(reports.projectId, projectId)))
    .limit(1);
  if (!row) throw new NotFoundError("El informe no existe.");
  if (row.kind !== "word") throw new ValidationError("Solo los informes Word pasan por aprobación.");
  return row;
}

/** Cambia el estado solo si sigue en el esperado (dos personas no aprueban a la vez). */
async function cambiarEstado(reportId: string, desde: ReportState[], valores: Partial<typeof reports.$inferInsert>) {
  for (const estado of desde) {
    const res = await db
      .update(reports)
      .set(valores)
      .where(and(eq(reports.id, reportId), eq(reports.estado, estado)))
      .returning({ id: reports.id });
    if (res.length) return;
  }
  throw new ConflictError("El estado del informe cambió mientras tanto. Recargue la página.");
}

/** El técnico envía el borrador (o el devuelto, ya corregido) al aprobador. */
export async function enviarRevision(projectId: string, reportId: string, user: CurrentUser) {
  const rep = await informeWord(projectId, reportId);
  if (rep.estado !== "borrador" && rep.estado !== "devuelto") {
    throw new ConflictError("El informe ya fue enviado a revisión.");
  }
  await cambiarEstado(reportId, ["borrador", "devuelto"], {
    estado: "revision",
    enviadoBy: user.id,
    enviadoAt: new Date(),
  });
  return rep.fileName;
}

/** Fecha de hoy en Colombia (AAAA-MM-DD). */
function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/**
 * El aprobador firma «Autorizó» con su nombre y cargo: se genera la versión
 * final (el mismo Word, solo cambia el cuadro de control).
 */
export async function aprobar(projectId: string, reportId: string, user: CurrentUser) {
  if (!puedeAprobar(user.role)) throw new ForbiddenError();
  const rep = await informeWord(projectId, reportId);
  if (rep.estado !== "revision") throw new ConflictError("Solo se aprueban informes enviados a revisión.");
  if (rep.createdBy === user.id) {
    throw new ValidationError("No puede aprobar un informe que usted mismo generó: «Elaboró» y «Autorizó» deben ser personas distintas.");
  }
  const nombre = user.fullName?.trim();
  if (!nombre) throw new ValidationError("Escriba su nombre y cargo en Mi perfil antes de aprobar: con ellos se firma «Autorizó».");

  const firmado = await engine.firmar({
    informe: { url: await downloadUrl(rep.fileKey, { ttl: ENGINE_URL_TTL }), nombre: rep.fileName },
    nombre,
    cargo: user.cargo,
    fecha: hoyColombia(),
  });
  const key = newKey("informe", projectId, "docx");
  await putObject(key, firmado.bytes, firmado.contentType);
  try {
    await cambiarEstado(reportId, ["revision"], {
      estado: "aprobado",
      revisadoBy: user.id,
      revisadoAt: new Date(),
      observaciones: "",
      aprobadoKey: key,
      aprobadoNombre: firmado.fileName,
    });
  } catch (e) {
    await deleteObject(key);
    throw e;
  }
  return rep.fileName;
}

/** El aprobador devuelve el informe al técnico con sus observaciones. */
export async function devolver(projectId: string, reportId: string, user: CurrentUser, observaciones: string) {
  if (!puedeAprobar(user.role)) throw new ForbiddenError();
  const rep = await informeWord(projectId, reportId);
  if (rep.estado !== "revision") throw new ConflictError("Solo se devuelven informes enviados a revisión.");
  const texto = observaciones.trim();
  if (texto.length < 3) throw new ValidationError("Escriba qué se debe corregir.", { observaciones: ["Escriba qué se debe corregir."] });
  await cambiarEstado(reportId, ["revision"], {
    estado: "devuelto",
    revisadoBy: user.id,
    revisadoAt: new Date(),
    observaciones: texto.slice(0, 2000),
  });
  return rep.fileName;
}

const autor = alias(users, "autor");
const enviador = alias(users, "enviador");
const revisor = alias(users, "revisor");

/** Informes de un proyecto con los nombres de quien los generó, envió y revisó. */
export async function listReportsDetalle(projectId: string) {
  return db
    .select({
      id: reports.id,
      kind: reports.kind,
      fileName: reports.fileName,
      size: reports.size,
      advertencias: reports.advertencias,
      createdAt: reports.createdAt,
      createdBy: reports.createdBy,
      estado: reports.estado,
      enviadoAt: reports.enviadoAt,
      revisadoAt: reports.revisadoAt,
      observaciones: reports.observaciones,
      aprobadoNombre: reports.aprobadoNombre,
      autor: autor.fullName,
      autorEmail: autor.email,
      enviador: enviador.fullName,
      revisor: revisor.fullName,
    })
    .from(reports)
    .leftJoin(autor, eq(autor.id, reports.createdBy))
    .leftJoin(enviador, eq(enviador.id, reports.enviadoBy))
    .leftJoin(revisor, eq(revisor.id, reports.revisadoBy))
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt));
}
export type InformeDetalle = Awaited<ReturnType<typeof listReportsDetalle>>[number];

/** Bandeja del aprobador: informes Word en revisión de todos los proyectos. */
export async function listPendientes() {
  const rows = await db
    .select({
      id: reports.id,
      fileName: reports.fileName,
      createdAt: reports.createdAt,
      createdBy: reports.createdBy,
      enviadoAt: reports.enviadoAt,
      autor: autor.fullName,
      autorEmail: autor.email,
      enviador: enviador.fullName,
      projectId: projects.id,
      tipo: projects.tipo,
      nombre: projects.nombre,
      cliente: projects.cliente,
      codigo: projects.codigoInforme,
    })
    .from(reports)
    .innerJoin(projects, eq(projects.id, reports.projectId))
    .leftJoin(autor, eq(autor.id, reports.createdBy))
    .leftJoin(enviador, eq(enviador.id, reports.enviadoBy))
    .where(eq(reports.estado, "revision"))
    .orderBy(reports.enviadoAt);
  return rows.map((r) => ({ ...r, href: hrefInformes(r.projectId, r.tipo) }));
}

export async function contarPendientes(): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(reports).where(eq(reports.estado, "revision"));
  return n;
}

/** Informes Word del usuario que el aprobador le devolvió para corregir. */
export async function listDevueltos(userId: string) {
  const rows = await db
    .select({
      id: reports.id,
      fileName: reports.fileName,
      observaciones: reports.observaciones,
      revisadoAt: reports.revisadoAt,
      revisor: revisor.fullName,
      projectId: projects.id,
      tipo: projects.tipo,
      nombre: projects.nombre,
    })
    .from(reports)
    .innerJoin(projects, eq(projects.id, reports.projectId))
    .leftJoin(revisor, eq(revisor.id, reports.revisadoBy))
    .where(and(eq(reports.estado, "devuelto"), eq(reports.createdBy, userId)))
    .orderBy(desc(reports.revisadoAt));
  return rows.map((r) => ({ ...r, href: hrefInformes(r.projectId, r.tipo) }));
}

function hrefInformes(id: string, tipo: (typeof projects.$inferSelect)["tipo"]): string {
  return `${hrefProyecto({ id, tipo })}${tipo === "ambiental" || tipo === "emision" ? "/resultados" : ""}#informes`;
}
