import "server-only";
import bcrypt from "bcryptjs";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { equipment, users, type UserRole } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { isUuid } from "./projects";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

/** Inventario inicial (el mismo equipos.json de la aplicación de escritorio). */
const DEFAULT_EQUIPMENT = [
  { nombre: "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", codigo: "612-C", serial: "0006599" },
  { nombre: "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", codigo: "750-C", serial: "0007214" },
  { nombre: "Sonometro LARSON DAVIS SOUND EXPERT 821", codigo: "825-C", serial: "40034" },
  { nombre: "Sonometro LARSON DAVIS SOUND EXPERT 821", codigo: "824-C", serial: "40013" },
  { nombre: "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", codigo: "617-C", serial: "0006973" },
  { nombre: "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", codigo: "713-C", serial: "0007215" },
  { nombre: "Sonometro LARSON DAVIS SOUND EXPERT 821", codigo: "1014-C", serial: "40798" },
  { nombre: "Sonometro LARSON DAVIS SOUND EXPERT 821", codigo: "1016-C", serial: "40799" },
];

export async function hasUsers(): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n > 0;
}

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, fullName: users.fullName, cargo: users.cargo, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.email));
}

export async function createUser(input: { email: string; fullName: string; cargo: string; password: string; role: UserRole }) {
  try {
    await db.insert(users).values({
      email: input.email,
      fullName: input.fullName || null,
      cargo: input.cargo,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, ROUNDS),
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("Ya existe un usuario con ese correo.");
    throw e;
  }
}

/**
 * Configuración inicial: crea el primer administrador y siembra el
 * inventario de equipos. Solo funciona mientras no exista ningún usuario
 * (bloqueo de tabla para evitar dos configuraciones simultáneas).
 */
export async function setupFirstAdmin(input: { email: string; fullName: string; password: string }) {
  const hash = await bcrypt.hash(input.password, ROUNDS);
  await db.transaction(async (tx) => {
    await tx.execute("LOCK TABLE users IN EXCLUSIVE MODE");
    const [{ n }] = await tx.select({ n: count() }).from(users);
    if (n > 0) throw new ConflictError("La aplicación ya fue configurada. Inicie sesión.");
    await tx.insert(users).values({ email: input.email, fullName: input.fullName || null, role: "admin", passwordHash: hash });
    const [{ e }] = await tx.select({ e: count() }).from(equipment);
    if (e === 0) await tx.insert(equipment).values(DEFAULT_EQUIPMENT);
  });
}

export async function setPassword(id: string, password: string) {
  if (!isUuid(id)) throw new NotFoundError();
  const res = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(password, ROUNDS) })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (res.length === 0) throw new NotFoundError();
}

/** Nombre y cargo con los que el usuario firma «Elaboró». */
export async function setProfile(id: string, input: { fullName: string; cargo: string }) {
  if (!isUuid(id)) throw new NotFoundError();
  const res = await db
    .update(users)
    .set({ fullName: input.fullName || null, cargo: input.cargo })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (res.length === 0) throw new NotFoundError();
}

export async function setRole(id: string, role: UserRole, actingUserId: string) {
  if (!isUuid(id)) throw new NotFoundError();
  if (id === actingUserId && role !== "admin") {
    throw new ValidationError("No puede quitarse a sí mismo el rol de administrador.");
  }
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(id: string, actingUserId: string) {
  if (!isUuid(id)) throw new NotFoundError();
  if (id === actingUserId) throw new ValidationError("No puede eliminar su propia cuenta.");
  await db.delete(users).where(eq(users.id, id));
}

/** Correo de un usuario (para el registro de actividad); "" si no existe. */
export async function userEmail(id: string): Promise<string> {
  const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  return row?.email ?? "";
}
