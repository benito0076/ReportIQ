import type { DatosInforme } from "./validation";

/** Datos del informe con las claves del motor (snake_case) y las firmas de Ajustes. */
export function informePayload(
  informe: Partial<DatosInforme>,
  firmas: { elaboroNombre: string; elaboroCargo: string; autorizoNombre: string; autorizoCargo: string },
): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...informe, ...firmas })) {
    if (typeof v !== "string" || (k === "version" && !v)) continue;
    salida[k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = v;
  }
  return salida;
}
