import "server-only";
import { headers } from "next/headers";
import { and, count, desc, eq, gt, gte, lt, lte, max, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ACTIVITY_EVENTS, ACTIVITY_LABELS, type ActivityEvent } from "@/db/enums";
import { activityLog } from "@/db/schema";

/** Los registros más antiguos que esto se borran solos. */
export const RETENCION_DIAS = 365;
export const PAGINA = 100;

/** IP y navegador de la petición en curso (Vercel pone la IP del cliente en x-forwarded-for). */
async function origen(): Promise<{ ip: string; userAgent: string }> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
    return { ip: ip.slice(0, 64), userAgent: (h.get("user-agent") ?? "").slice(0, 500) };
  } catch {
    return { ip: "", userAgent: "" }; // fuera de una petición (pruebas, tareas)
  }
}

/** Límite de intentos: tras MAX_FALLIDOS seguidos, el correo queda bloqueado BLOQUEO_MIN minutos. */
export const MAX_FALLIDOS = 5;
export const BLOQUEO_MIN = 15;
/** Desde una misma IP (varias cuentas): más tolerante, para oficinas con IP compartida. */
export const MAX_FALLIDOS_IP = 20;

/**
 * Minutos que faltan para poder volver a intentar, o 0 si no está bloqueado.
 * Cuenta los intentos fallidos de los últimos BLOQUEO_MIN minutos posteriores
 * al último inicio de sesión correcto (por correo) y, aparte, por IP.
 */
export async function minutosBloqueo(email: string): Promise<number> {
  const ventana = new Date(Date.now() - BLOQUEO_MIN * 60 * 1000);
  const { ip } = await origen();
  // Un inicio correcto o un restablecimiento de contraseña (por un administrador) desbloquean.
  const [ultimoOk] = await db
    .select({ t: max(activityLog.createdAt) })
    .from(activityLog)
    .where(
      and(
        gte(activityLog.createdAt, ventana),
        or(
          and(eq(activityLog.email, email), eq(activityLog.event, "login_ok")),
          and(eq(activityLog.detail, email), eq(activityLog.event, "contrasena_restablecida")),
        ),
      ),
    );
  const desde = ultimoOk?.t && ultimoOk.t > ventana ? ultimoOk.t : ventana;
  const fallidos = (where: SQL | undefined) =>
    db
      .select({ n: count(), ultimo: max(activityLog.createdAt) })
      .from(activityLog)
      .where(and(eq(activityLog.event, "login_fallido"), gt(activityLog.createdAt, desde), where))
      .then((r) => r[0]);
  const [porCorreo, porIp] = await Promise.all([
    fallidos(eq(activityLog.email, email)),
    ip ? fallidos(eq(activityLog.ip, ip)) : Promise.resolve({ n: 0, ultimo: null }),
  ]);
  const bloqueadoHasta = (f: { n: number; ultimo: Date | null }, limite: number) =>
    f.n >= limite && f.ultimo ? f.ultimo.getTime() + BLOQUEO_MIN * 60 * 1000 : 0;
  const hasta = Math.max(bloqueadoHasta(porCorreo, MAX_FALLIDOS), bloqueadoHasta(porIp, MAX_FALLIDOS_IP));
  return hasta > Date.now() ? Math.ceil((hasta - Date.now()) / 60000) : 0;
}

/**
 * Registra un evento. Nunca interrumpe la acción del usuario: si falla el
 * registro, solo se anota en el log del servidor.
 */
export async function logActivity(
  event: ActivityEvent,
  who: { id?: string | null; email?: string | null } | null,
  detail = "",
) {
  try {
    const { ip, userAgent } = await origen();
    await db.insert(activityLog).values({
      event,
      userId: who?.id ?? null,
      email: (who?.email ?? "").slice(0, 255),
      detail: detail.slice(0, 2000),
      ip,
      userAgent,
    });
    if (event === "login_ok") await purgeActivity();
  } catch (e) {
    console.error("No se pudo registrar la actividad", event, e);
  }
}

export async function purgeActivity() {
  const limite = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000);
  await db.delete(activityLog).where(lt(activityLog.createdAt, limite));
}

export interface ActivityFilters {
  email?: string;
  event?: string;
  desde?: string; // AAAA-MM-DD
  hasta?: string;
  pagina?: number;
}

function condiciones(f: ActivityFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.email) c.push(eq(activityLog.email, f.email));
  if (f.event && (ACTIVITY_EVENTS as readonly string[]).includes(f.event)) {
    c.push(eq(activityLog.event, f.event as ActivityEvent));
  }
  const desde = fecha(f.desde);
  const hasta = fecha(f.hasta);
  if (desde) c.push(gte(activityLog.createdAt, desde));
  if (hasta) c.push(lte(activityLog.createdAt, new Date(hasta.getTime() + 24 * 60 * 60 * 1000 - 1)));
  return c.length ? and(...c) : undefined;
}

function fecha(v?: string): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  // Días completos en hora de Colombia (UTC-5).
  const d = new Date(`${v}T00:00:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Una página de eventos (más recientes primero); pide uno de más para saber si hay siguiente. */
export async function listActivity(f: ActivityFilters) {
  const pagina = Math.max(1, f.pagina ?? 1);
  const filas = await db
    .select()
    .from(activityLog)
    .where(condiciones(f))
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGINA + 1)
    .offset((pagina - 1) * PAGINA);
  return { filas: filas.slice(0, PAGINA), hayMas: filas.length > PAGINA, pagina };
}

/** Correos que aparecen en el registro (para el filtro por usuario). */
export async function activityEmails(): Promise<string[]> {
  const filas = await db.selectDistinct({ email: activityLog.email }).from(activityLog).orderBy(activityLog.email);
  return filas.map((f) => f.email).filter(Boolean);
}

function csvCelda(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV para Excel (separador ";" y BOM para que abra bien con tildes). */
export async function activityCsv(f: ActivityFilters): Promise<string> {
  const filas = await db
    .select()
    .from(activityLog)
    .where(condiciones(f))
    .orderBy(desc(activityLog.createdAt))
    .limit(50_000);
  const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const lineas = [["Fecha y hora", "Usuario", "Evento", "Detalle", "IP", "Navegador"].join(";")];
  for (const r of filas) {
    lineas.push(
      [fmt.format(r.createdAt), r.email, ACTIVITY_LABELS[r.event] ?? r.event, r.detail, r.ip, r.userAgent]
        .map((v) => csvCelda(String(v ?? "")))
        .join(";"),
    );
  }
  return "﻿" + lineas.join("\r\n");
}
