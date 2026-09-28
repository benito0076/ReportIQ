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
} from "@/server/projects";
import { deleteReport } from "@/server/processing";
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
    id = await createProject(projectInput(form), user.id);
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
    const input = parseOrThrow(informeSchema, Object.fromEntries(INFORME_CAMPOS.map((k) => [k, str(form, k)])));
    await updateProjectInforme(projectId, input);
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, message: "Datos del informe guardados." };
}

/** Solo los administradores eliminan proyectos (se borran también memorias e informes). */
export async function deleteProjectAction(projectId: string) {
  await assertAdmin();
  await deleteProject(projectId);
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
  await setProjectMeteo(projectId, null, null);
  revalidatePath(`/proyectos/${projectId}`);
}

export async function removeMemoryAction(projectId: string, fileId: string) {
  await assertUser();
  await removeMemoryFile(projectId, fileId);
  revalidatePath(`/proyectos/${projectId}/memorias`);
}

export async function deleteReportAction(projectId: string, reportId: string) {
  await assertUser();
  await deleteReport(projectId, reportId);
  revalidatePath(`/proyectos/${projectId}/resultados`);
}
