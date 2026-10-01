import { z } from "zod";
import { USER_ROLES } from "@/db/enums";
import { ValidationError } from "./errors";
import sectores from "./sectores.json";

export const SECTORES: {
  etiqueta: string;
  sector: string;
  dia: number;
  noche: number;
  emisionDia: number;
  emisionNoche: number;
}[] = sectores;

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => v ?? "");

/** Número con coma o punto decimal (p. ej. "4919855,125"). */
export function parseDecimal(value: string): number | null {
  const t = value.trim().replace(",", ".");
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const coordinate = optionalText(50).refine(
  (v) => v === "" || parseDecimal(v) !== null,
  "Debe ser un número (use coma o punto decimal).",
);

/** Número simple (admite coma decimal y puntos de miles); null si es DMS u otro texto. */
function numeroCoordenada(texto: string | null | undefined): number | null {
  const t = (texto ?? "").trim();
  if (!/^-?[\d.,]+$/.test(t)) return null;
  const n = Number((t.split(".").length > 2 ? t.replaceAll(".", "") : t).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Revisa que la estación quede en Colombia: grados decimales (longitud/latitud)
 * o planas Origen Nacional (Este/Norte, EPSG:9377). Rangos aproximados.
 */
export function coordenadaFueraDeColombia(longitud: string | null | undefined, latitud: string | null | undefined) {
  const x = numeroCoordenada(longitud);
  const y = numeroCoordenada(latitud);
  if (x === null || y === null) return null;
  if (Math.abs(x) > 180 || Math.abs(y) > 180) {
    if (x < 3_900_000 || x > 5_800_000)
      return { campo: "longitud", mensaje: "El Este (Origen Nacional) en Colombia está entre 3.900.000 y 5.800.000 m." };
    if (y < 1_000_000 || y > 3_100_000)
      return { campo: "latitud", mensaje: "El Norte (Origen Nacional) en Colombia está entre 1.000.000 y 3.100.000 m." };
    return null;
  }
  if (x < -83 || x > -66) return { campo: "longitud", mensaje: "La longitud en Colombia está entre -83 y -66 (oeste)." };
  if (y < -5 || y > 14) return { campo: "latitud", mensaje: "La latitud en Colombia está entre -5 y 14." };
  return null;
}

/** Estación de calidad del aire: el número es la hoja CA-n / ESTACION n de las plantillas. */
export const airStationSchema = z.object({
  numero: z.coerce
    .number({ message: "Indique el número de la estación." })
    .int("Debe ser un número entero.")
    .min(1, "Mínimo 1.")
    .max(50, "Máximo 50."),
  nombre: optionalText(150),
  codigo: optionalText(60),
  codigoAnla: optionalText(60),
  longitud: optionalText(50),
  latitud: optionalText(50),
  descripcion: optionalText(2000),
}).superRefine((v, ctx) => {
  const problema = coordenadaFueraDeColombia(v.longitud, v.latitud);
  if (problema) ctx.addIssue({ code: "custom", path: [problema.campo], message: problema.mensaje });
});
export type AirStationInput = z.output<typeof airStationSchema>;

export const projectSchema = z.object({
  nombre: text(255).min(1, "El nombre del proyecto es obligatorio."),
  cliente: optionalText(255),
  codigoInforme: optionalText(100),
});
export type ProjectInput = z.output<typeof projectSchema>;

/** Datos para redactar el informe Word (portada, encabezado, resumen, cliente). */
export const INFORME_CAMPOS = [
  "areaEstudio",
  "municipio",
  "departamento",
  "titulo",
  "expediente",
  "actoAdministrativo",
  "version",
  "fecha",
  "clienteNit",
  "clienteDireccion",
  "clienteContacto",
  "clienteCiudad",
  "clienteDepartamento",
  "clienteActividad",
] as const;

export const informeSchema = z.object({
  areaEstudio: optionalText(500),
  municipio: optionalText(120),
  departamento: optionalText(120),
  titulo: optionalText(600),
  expediente: optionalText(100),
  /** Resoluciones del acto administrativo (encabezado del informe de calidad del aire). */
  actoAdministrativo: optionalText(500),
  version: optionalText(20),
  fecha: optionalText(10).refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida."),
  clienteNit: optionalText(50),
  clienteDireccion: optionalText(300),
  clienteContacto: optionalText(300),
  clienteCiudad: optionalText(120),
  clienteDepartamento: optionalText(120),
  clienteActividad: optionalText(1000),
});
export type DatosInforme = z.output<typeof informeSchema>;

export const pointSchema = z.object({
  nombre: text(100).min(1, "El punto debe tener un nombre."),
  sector: optionalText(1000).refine(
    (v) => v === "" || SECTORES.some((s) => s.etiqueta === v),
    "Seleccione un sector de la lista.",
  ),
  incertidumbre: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseDecimal(v || "0");
      if (n === null || n < 0) {
        ctx.addIssue({ code: "custom", message: "La incertidumbre debe ser un número positivo." });
        return z.NEVER;
      }
      return n;
    }),
  este: coordinate,
  norte: coordinate,
  altitud: optionalText(50),
  descripcion: optionalText(5000),
  fuentes: optionalText(5000),
});
export type PointInput = z.output<typeof pointSchema>;

export const equipmentSchema = z.object({
  nombre: text(255).min(1, "El nombre es obligatorio."),
  codigo: optionalText(50),
  serial: text(100).min(1, "El número de serie es obligatorio."),
});
export type EquipmentInput = z.output<typeof equipmentSchema>;

const email = z.string().trim().toLowerCase().pipe(z.email("Correo electrónico inválido."));
const password = z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(200);

export const newUserSchema = z.object({
  fullName: optionalText(255),
  email,
  password,
  role: z.enum(USER_ROLES),
});

export const setupSchema = z.object({ fullName: optionalText(255), email, password });

export const passwordSchema = z.object({ password });

export const settingsSchema = z.object({
  elaboradoPor: optionalText(255),
  elaboroNombre: optionalText(255),
  elaboroCargo: optionalText(255),
  autorizoNombre: optionalText(255),
  autorizoCargo: optionalText(255),
});
export type SettingsInput = z.output<typeof settingsSchema>;

/** Valida y convierte los errores de Zod en un ValidationError por campo. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw new ValidationError("Revise los campos marcados.", fieldErrors);
}
