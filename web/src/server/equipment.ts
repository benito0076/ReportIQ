import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { equipment } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { EquipmentInput } from "@/lib/validation";
import { isUuid } from "./projects";

export async function listEquipment() {
  return db.select().from(equipment).orderBy(asc(equipment.codigo));
}

export async function countEquipment() {
  const [{ n }] = await db.select({ n: count() }).from(equipment);
  return n;
}

export async function createEquipment(input: EquipmentInput) {
  await db.insert(equipment).values(input);
}

export async function updateEquipment(id: string, input: EquipmentInput) {
  if (!isUuid(id)) throw new NotFoundError();
  const res = await db.update(equipment).set(input).where(eq(equipment.id, id)).returning({ id: equipment.id });
  if (res.length === 0) throw new NotFoundError();
}

/** Elimina el equipo; devuelve "nombre (código, serial)" para el registro de actividad. */
export async function deleteEquipment(id: string): Promise<string | null> {
  if (!isUuid(id)) throw new NotFoundError();
  const [row] = await db
    .delete(equipment)
    .where(eq(equipment.id, id))
    .returning({ nombre: equipment.nombre, codigo: equipment.codigo, serial: equipment.serial });
  return row ? `${row.nombre} (${[row.codigo, row.serial].filter(Boolean).join(", ")})` : null;
}

/**
 * Normaliza un número de serie igual que core/equipos.py: se ignoran los
 * ceros a la izquierda (6599, "6599" y "0006599" son el mismo equipo).
 */
export function normalizeSerial(serial: string): string {
  const t = serial.trim();
  const digits = t.replace(/\D/g, "");
  if (digits) return digits.replace(/^0+/, "") || "0";
  return t.toLowerCase();
}
