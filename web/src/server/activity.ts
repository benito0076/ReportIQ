import "server-only";
import { headers } from "next/headers";
import { and, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
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
