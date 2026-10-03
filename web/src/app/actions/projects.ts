"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, assertUser } from "@/lib/session";
import { INFORME_CAMPOS, informeSchema, parseOrThrow, pointSchema, projectSchema } from "@/lib/validation";
import {
  createPoint,
  createProject,
  deletePoint,
  deleteProject,
  movePoint,
  removeMemoryFile,
  setPointPhoto,
  setProjectMeteo,
  updatePoint,
  updateProject,
  updateProjectInforme,
  removeBarrido,
  updateBarrido,
} from "@/server/projects";
import type { CondicionBarrido } from "@/db/enums";
import { deleteReport } from "@/server/processing";
import { logActivity } from "@/server/activity";
import { getProject } from "@/server/projects";
import { duplicateProject } from "@/server/duplicar";
import { aprobar, devolver, enviarRevision } from "@/server/aprobaciones";
import { str, toActionState, type ActionState } from "./state";

function projectInput(form: FormData) {
  return parseOrThrow(projectSchema, {
    nombre: str(form, "nombre"),
    cliente: str(form, "cliente"),
    codigoInforme: str(form, "codigoInforme"),
  });
}

function pointInput(form: FormData) {
  return parseOrThrow(pointSchema, {
    nombre: str(form, "nombre"),
    sector: str(form, "sector"),
    incertidumbre: str(form, "incertidumbre"),
    este: str(form, "este"),
    norte: str(form, "norte"),
    altitud: str(form, "altitud"),
    descripcion: str(form, "descripcion"),
    fuentes: str(form, "fuentes"),
  });
}

export async function createProjectAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertUser();
    const tipo = str(form, "tipo") === "emision" ? "emision" : "ambiental";
    const input = projectInput(form);
    id = await createProject(input, tipo, user.id);
    await logActivity("proyecto_creado", user, `${input.nombre} (${tipo === "emision" ? "emisión" : "ambiental"})`);
  } catch (e) {
    return toActionState(e, form);
  }
  redirect(`/proyectos/${id}`);
}

export async function updateProjectAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await updateProject(projectId, projectInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, message: "Datos del proyecto guardados." };
}

export async function updateInformeAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await getProject(projectId);
    const input = parseOrThrow(informeSchema, Object.fromEntries(INFORME_CAMPOS.map((k) => [k, str(form, k)])));
    await updateProjectInforme(projectId, input);
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath(`/aire/${projectId}`);
  revalidatePath(`/vertimientos/${projectId}`);
  return { ok: true, message: "Datos del informe guardados." };
}

/** Solo los administradores eliminan proyectos (se borran también memorias e informes). */
export async function deleteProjectAction(projectId: string) {
  const admin = await assertAdmin();
  const project = await getProject(projectId);
  await deleteProject(projectId);
  await logActivity("proyecto_eliminado", admin, [project.nombre, project.codigoInforme].filter(Boolean).join(" · "));
  redirect("/proyectos");
}

export async function createPointAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  let pointId: string;
  try {
    await assertUser();
    pointId = await createPoint(projectId, pointInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  // Se abre la ficha del punto para poder agregar la foto.
  redirect(`/proyectos/${projectId}/puntos/${pointId}?creado=1`);
}

export async function updatePointAction(
  projectId: string,
  pointId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await assertUser();
    await updatePoint(projectId, pointId, pointInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  redirect(`/proyectos/${projectId}`);
}

export async function deletePointAction(projectId: string, pointId: string) {
  await assertUser();
  await deletePoint(projectId, pointId);
  revalidatePath(`/proyectos/${projectId}`);
}

export async function movePointAction(projectId: string, pointId: string, delta: -1 | 1) {
  await assertUser();
  await movePoint(projectId, pointId, delta);
  revalidatePath(`/proyectos/${projectId}`);
}

export async function removePhotoAction(projectId: string, pointId: string) {
  await assertUser();
  await setPointPhoto(projectId, pointId, null, null);
  revalidatePath(`/proyectos/${projectId}/puntos/${pointId}`);
}

export async function removeMeteoAction(projectId: string) {
  await assertUser();
  await getProject(projectId);
  await setProjectMeteo(projectId, null, null);
  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath(`/aire/${projectId}`);
  revalidatePath(`/vertimientos/${projectId}`);
}

export async function removeMemoryAction(projectId: string, fileId: string) {
  await assertUser();
  await removeMemoryFile(projectId, fileId);
  revalidatePath(`/proyectos/${projectId}/memorias`);
}

export async function updateBarridoAction(
  projectId: string,
  barridoId: string,
  values: { condicion?: CondicionBarrido; seleccionado?: boolean },
) {
  await assertUser();
  const limpio: { condicion?: CondicionBarrido; seleccionado?: boolean } = {};
  if (values.condicion === "Encendido" || values.condicion === "Apagado") limpio.condicion = values.condicion;
  if (typeof values.seleccionado === "boolean") limpio.seleccionado = values.seleccionado;
  await updateBarrido(projectId, barridoId, limpio);
  revalidatePath(`/proyectos/${projectId}/memorias`);
}

export async function removeBarridoAction(projectId: string, barridoId: string) {
  await assertUser();
  await removeBarrido(projectId, barridoId);
  revalidatePath(`/proyectos/${projectId}/memorias`);
}

function revalidarInformes(projectId: string) {
  revalidatePath(`/proyectos/${projectId}/resultados`);
  revalidatePath(`/aire/${projectId}`);
  revalidatePath(`/vertimientos/${projectId}`);
  revalidatePath("/aprobaciones");
  revalidatePath("/inicio");
}

export async function deleteReportAction(projectId: string, reportId: string): Promise<ActionState> {
  try {
    const user = await assertUser();
    await getProject(projectId);
    const nombre = await deleteReport(projectId, reportId, user.role);
    await logActivity("informe_eliminado", user, nombre);
  } catch (e) {
    return toActionState(e);
  }
  revalidarInformes(projectId);
  return { ok: true };
}

// ------------------------------------------------------- aprobación de informes
export async function enviarRevisionAction(projectId: string, reportId: string): Promise<ActionState> {
  try {
    const user = await assertUser();
    const nombre = await enviarRevision(projectId, reportId, user);
    await logActivity("informe_enviado_revision", user, nombre);
  } catch (e) {
    return toActionState(e);
  }
  revalidarInformes(projectId);
  return { ok: true, message: "Informe enviado al aprobador." };
}

export async function aprobarAction(projectId: string, reportId: string): Promise<ActionState> {
  try {
    const user = await assertUser();
    const nombre = await aprobar(projectId, reportId, user);
    await logActivity("informe_aprobado", user, nombre);
  } catch (e) {
    return toActionState(e);
  }
  revalidarInformes(projectId);
  return { ok: true, message: "Informe aprobado." };
}

export async function devolverAction(projectId: string, reportId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await assertUser();
    const observaciones = str(form, "observaciones");
    const nombre = await devolver(projectId, reportId, user, observaciones);
    await logActivity("informe_devuelto", user, `${nombre}: ${observaciones.slice(0, 200)}`);
  } catch (e) {
    return toActionState(e, form);
  }
  revalidarInformes(projectId);
  return { ok: true, message: "Informe devuelto con sus observaciones." };
}

/** Duplica un proyecto (cualquier matriz) para un nuevo monitoreo y abre la copia. */
export async function duplicateProjectAction(projectId: string): Promise<ActionState> {
  let href: string;
  try {
    const user = await assertUser();
    const original = await getProject(projectId);
    const copia = await duplicateProject(projectId, user.id);
    await logActivity("proyecto_duplicado", user, `${original.nombre} → ${copia.nombre}`);
    href = copia.href;
  } catch (e) {
    return toActionState(e);
  }
  redirect(href);
}
