"use server";

import { revalidatePath } from "next/cache";
import { USER_ROLES, type UserRole } from "@/db/enums";
import { assertAdmin, assertUser } from "@/lib/session";
import {
  equipmentSchema,
  newUserSchema,
  parseOrThrow,
  passwordSchema,
  settingsSchema,
} from "@/lib/validation";
import { createEquipment, deleteEquipment, updateEquipment } from "@/server/equipment";
import { updateSettings } from "@/server/settings";
import { createUser, deleteUser, setPassword, setRole } from "@/server/users";
import { str, toActionState, type ActionState } from "./state";

// --------------------------------------------------------------- equipos
function equipmentInput(form: FormData) {
  return parseOrThrow(equipmentSchema, {
    nombre: str(form, "nombre"),
    codigo: str(form, "codigo"),
    serial: str(form, "serial"),
  });
}

export async function createEquipmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await createEquipment(equipmentInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath("/equipos");
  return { ok: true, message: "Equipo agregado." };
}

export async function updateEquipmentAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertUser();
    await updateEquipment(id, equipmentInput(form));
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath("/equipos");
  return { ok: true, message: "Equipo actualizado." };
}

/** Solo los administradores eliminan equipos del inventario. */
export async function deleteEquipmentAction(id: string) {
  await assertAdmin();
  await deleteEquipment(id);
  revalidatePath("/equipos");
}

// -------------------------------------------------------------- usuarios
export async function createUserAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    await createUser(
      parseOrThrow(newUserSchema, {
        fullName: str(form, "fullName"),
        email: str(form, "email"),
        password: str(form, "password"),
        role: str(form, "role"),
      }),
    );
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuario creado. Comparta la contraseña con la persona de forma segura." };
}

export async function resetPasswordAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const { password } = parseOrThrow(passwordSchema, { password: str(form, "password") });
    await setPassword(id, password);
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true, message: "Contraseña actualizada." };
}

export async function setRoleAction(id: string, role: UserRole): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    if (!USER_ROLES.includes(role)) return { error: "Rol inválido." };
    await setRole(id, role, admin.id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function deleteUserAction(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    await deleteUser(id, admin.id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

// ---------------------------------------------------------------- ajustes
export async function updateSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    await updateSettings(
      parseOrThrow(settingsSchema, {
        elaboradoPor: str(form, "elaboradoPor"),
        elaboroNombre: str(form, "elaboroNombre"),
        elaboroCargo: str(form, "elaboroCargo"),
        autorizoNombre: str(form, "autorizoNombre"),
        autorizoCargo: str(form, "autorizoCargo"),
      }),
    );
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath("/ajustes");
  return { ok: true, message: "Ajustes guardados." };
}

export async function removeTemplateAction() {
  await assertAdmin();
  await updateSettings({ plantillaKey: null, plantillaNombre: null });
  revalidatePath("/ajustes");
}
