import { DIRECCIONES, type Direccion } from "@/db/enums";

const LETRAS: Record<string, Direccion> = { v: "Vertical", n: "Norte", s: "Sur", e: "Este", o: "Oeste", w: "Oeste" };

/**
 * Deduce la dirección del micrófono a partir del nombre del archivo
 * ("RA1_Norte.xlsx", "P2 - oeste.xlsx", "RA3_V.xlsx"). Devuelve null si no
 * se puede determinar con seguridad (ninguna o varias coincidencias).
 */
export function detectDireccion(fileName: string): Direccion | null {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const tokens = base.split(/[^a-z0-9]+/).filter(Boolean);

  const porPalabra = new Set<Direccion>();
  for (const t of tokens) {
    const d = DIRECCIONES.find((d) => d.toLowerCase() === t);
    if (d) porPalabra.add(d);
  }
  if (porPalabra.size === 1) return [...porPalabra][0];
  if (porPalabra.size > 1) return null;

  const porLetra = new Set<Direccion>();
  for (const t of tokens) if (LETRAS[t]) porLetra.add(LETRAS[t]);
  return porLetra.size === 1 ? [...porLetra][0] : null;
}
