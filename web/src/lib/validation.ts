import { z } from "zod";
import { USER_ROLES } from "@/db/enums";
import { ValidationError } from "./errors";
import sectores from "./sectores.json";

export const SECTORES: { etiqueta: string; sector: string; dia: number; noche: number }[] = sectores;

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

export const projectSchema = z.object({
  nombre: text(255).min(1, "El nombre del proyecto es obligatorio."),
  cliente: optionalText(255),
  codigoInforme: optionalText(100),
});
export type ProjectInput = z.output<typeof projectSchema>;

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

export const settingsSchema = z.object({ elaboradoPor: optionalText(255) });

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
