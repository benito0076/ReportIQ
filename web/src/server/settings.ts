import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings, users } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
import type { SettingsInput } from "@/lib/validation";

export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return (
    row ?? {
      id: 1,
      elaboradoPor: "",
      elaboroNombre: "",
      elaboroCargo: "",
      autorizoNombre: "",
      autorizoCargo: "",
      plantillaKey: null,
      plantillaNombre: null,
      updatedAt: new Date(),
    }
  );
}

export async function updateSettings(
  values: Partial<SettingsInput & { plantillaKey: string | null; plantillaNombre: string | null }>,
) {
  const previous = await getSettings();
  await db
    .insert(settings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: settings.id, set: values });
  if ("plantillaKey" in values && previous.plantillaKey && previous.plantillaKey !== values.plantillaKey) {
    await deleteObject(previous.plantillaKey);
  }
}

export interface Firmas {
  elaboroNombre: string;
  elaboroCargo: string;
  autorizoNombre: string;
  autorizoCargo: string;
}

/**
 * Firmas del cuadro de control: «Elaboró» es el usuario que genera el informe
 * (nombre y cargo de su perfil); si no tiene nombre, se usa el de Ajustes.
 * «Autorizó» siempre sale de Ajustes.
 */
export async function firmasInforme(userId?: string | null): Promise<Firmas> {
  const [s, usuario] = await Promise.all([
    getSettings(),
    userId
      ? db
          .select({ fullName: users.fullName, cargo: users.cargo })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
          .then((r) => r[0])
      : undefined,
  ]);
  const propio = usuario?.fullName?.trim();
  return {
    elaboroNombre: propio || s.elaboroNombre,
    elaboroCargo: propio ? usuario!.cargo.trim() : s.elaboroCargo,
    autorizoNombre: s.autorizoNombre,
    autorizoCargo: s.autorizoCargo,
  };
}
