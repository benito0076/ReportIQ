/** Asignación de los reportes del laboratorio a los puntos de vertimientos por su nombre. */

/** Nombre normalizado para comparar el punto del reporte con los del proyecto. */
export function normalizarPunto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(del|de|la|el|los|las)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Punto del proyecto que corresponde al nombre del reporte (exacto o contenido uno en otro). */
export function puntoParaReporte<T extends { nombre: string }>(puntos: T[], nombreReporte: string): T | undefined {
  const objetivo = normalizarPunto(nombreReporte);
  if (!objetivo) return undefined;
  const exacto = puntos.find((p) => normalizarPunto(p.nombre) === objetivo);
  if (exacto) return exacto;
  const parciales = puntos.filter((p) => {
    const n = normalizarPunto(p.nombre);
    return n && (n.includes(objetivo) || objetivo.includes(n));
  });
  return parciales.length === 1 ? parciales[0] : undefined;
}
