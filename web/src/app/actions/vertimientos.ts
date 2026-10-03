"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, assertUser } from "@/lib/session";
import { configVertimientoSchema, parseOrThrow, projectSchema, waterPointSchema } from "@/lib/validation";
import { logActivity } from "@/server/activity";
import { deleteProject, updateProject } from "@/server/projects";
import {
  createVertProject,
  createWaterPoint,
  deleteWaterPoint,
  getVertProject,
  removeFp004,
  removeWaterPointFile,
  setConfigVertimiento,
  updateWaterPoint,
} from "@/server/vertimientos";
import { str, toActionState, type ActionState } from "./state";

/** Vertimientos: cualquier usuario crea y procesa proyectos; eliminarlos es solo para administradores. */

function projectInput(form: FormData) {
  return parseOrThrow(projectSchema, {
    nombre: str(form, "nombre"),
    cliente: str(form, "cliente"),
    codigoInforme: str(form, "codigoInforme"),
  });
}

function pointInput(form: FormData) {
  return parseOrThrow(waterPointSchema, {
    nombre: str(form, "nombre"),
    hojaFp: str(form, "hojaFp"),
    evaluar: form.get("evaluar") === "on",
    tipoAgua: str(form, "tipoAgua") || "ARnD",
    longitud: str(form, "longitud"),
    latitud: str(form, "latitud"),
    descripcion: str(form, "descripcion"),
  });
}

export async function createVertProjectAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertUser();
    const input = projectInput(form);
    id = await createVertProject(input, user.id);
    await logActivity("proyecto_creado", user, `${input.nombre} (vertimientos)`);
  } catch (e) {
    return toActionState(e, form);
  }
  redirect(`/vertimientos/${id}`);
}

export async function updateVertProjectAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await getVertProject(projectId);
    await updateProject(projectId, projectInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/vertimientos/${projectId}`);
  return { ok: true, message: "Datos del proyecto guardados." };
}

export async function deleteVertProjectAction(projectId: string) {
  const admin = await assertAdmin();
  const project = await getVertProject(projectId);
  await deleteProject(projectId);
  await logActivity("proyecto_eliminado", admin, [project.nombre, project.codigoInforme].filter(Boolean).join(" · "));
  redirect("/vertimientos");
}

export async function saveNormaAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await setConfigVertimiento(
      projectId,
      parseOrThrow(configVertimientoSchema, {
        actividades: form.getAll("actividades").map(String),
        alcantarillado: form.get("alcantarillado") === "on",
        consumoHumano: form.get("consumoHumano") === "on",
      }),
    );
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/vertimientos/${projectId}`);
  return { ok: true, message: "Norma aplicable guardada." };
}

export async function createWaterPointAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await createWaterPoint(projectId, pointInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/vertimientos/${projectId}`);
  return { ok: true, message: "Punto agregado." };
}

export async function updateWaterPointAction(
  projectId: string,
  pointId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await assertUser();
    await updateWaterPoint(projectId, pointId, pointInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/vertimientos/${projectId}`);
  return { ok: true, message: "Punto guardado." };
}

export async function deleteWaterPointAction(projectId: string, pointId: string) {
  await assertUser();
  await deleteWaterPoint(projectId, pointId);
  revalidatePath(`/vertimientos/${projectId}`);
}

export async function removeWaterPointFileAction(projectId: string, pointId: string, archivo: "informe" | "foto") {
  await assertUser();
  await removeWaterPointFile(projectId, pointId, archivo === "foto" ? "foto" : "informe");
  revalidatePath(`/vertimientos/${projectId}`);
}

export async function removeFp004Action(projectId: string) {
  await assertUser();
  await removeFp004(projectId);
  revalidatePath(`/vertimientos/${projectId}`);
}
