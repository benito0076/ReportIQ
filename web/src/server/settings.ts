import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
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
