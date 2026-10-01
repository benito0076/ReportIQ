"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PLANTILLAS_AIRE, type PlantillaAire } from "@/db/enums";
import { ValidationError } from "@/lib/errors";
import { assertAdmin } from "@/lib/session";
import { airStationSchema, parseOrThrow, projectSchema } from "@/lib/validation";
import { logActivity } from "@/server/activity";
import {
  createAireProject,
  createStation,
  deleteStation,
  getAireProject,
  removeAirFile,
  updateStation,
} from "@/server/aire";
import { deleteProject, updateProject } from "@/server/projects";
import { str, toActionState, type ActionState } from "./state";

/** Calidad del aire está en desarrollo: todas las acciones son solo para administradores. */

function projectInput(form: FormData) {
  return parseOrThrow(projectSchema, {
    nombre: str(form, "nombre"),
    cliente: str(form, "cliente"),
    codigoInforme: str(form, "codigoInforme"),
  });
}

function stationInput(form: FormData) {
  return parseOrThrow(airStationSchema, {
    numero: str(form, "numero"),
    nombre: str(form, "nombre"),
    codigo: str(form, "codigo"),
    codigoAnla: str(form, "codigoAnla"),
    longitud: str(form, "longitud"),
    latitud: str(form, "latitud"),
    descripcion: str(form, "descripcion"),
  });
}

export async function createAireProjectAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertAdmin();
    const input = projectInput(form);
    id = await createAireProject(input, user.id);
    await logActivity("proyecto_creado", user, `${input.nombre} (calidad del aire)`);
  } catch (e) {
    return toActionState(e, form);
  }
  redirect(`/aire/${id}`);
}

export async function updateAireProjectAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    await getAireProject(projectId);
    await updateProject(projectId, projectInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/aire/${projectId}`);
  return { ok: true, message: "Datos del proyecto guardados." };
}

export async function deleteAireProjectAction(projectId: string) {
  const admin = await assertAdmin();
  const project = await getAireProject(projectId);
  await deleteProject(projectId);
  await logActivity("proyecto_eliminado", admin, [project.nombre, project.codigoInforme].filter(Boolean).join(" · "));
  redirect("/aire");
}

export async function createStationAction(projectId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    await createStation(projectId, stationInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/aire/${projectId}`);
  return { ok: true, message: "Estación agregada." };
}

export async function updateStationAction(
  projectId: string,
  stationId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await assertAdmin();
    await updateStation(projectId, stationId, stationInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath(`/aire/${projectId}`);
  return { ok: true, message: "Estación guardada." };
}

export async function deleteStationAction(projectId: string, stationId: string) {
  await assertAdmin();
  await deleteStation(projectId, stationId);
  revalidatePath(`/aire/${projectId}`);
}

export async function removeAirFileAction(projectId: string, plantilla: string) {
  await assertAdmin();
  if (!(PLANTILLAS_AIRE as readonly string[]).includes(plantilla)) throw new ValidationError("Plantilla inválida.");
  await removeAirFile(projectId, plantilla as PlantillaAire);
  revalidatePath(`/aire/${projectId}`);
}
