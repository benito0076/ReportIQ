import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { airStations, points, projects, waterPoints } from "@/db/schema";
import { copyObject, deleteObject, newKey, type FileKind } from "@/lib/storage";
import { getProject, hrefProyecto } from "./projects";

/** Datos del informe que cambian en cada monitoreo: no se copian. */
const CAMPOS_NUEVOS = ["fecha", "version"] as const;

/**
 * Duplica un proyecto para un nuevo monitoreo del mismo cliente: copia los
 * datos del cliente y del informe, la norma aplicable y los puntos o
 * estaciones (coordenadas, descripciones y fotos). No copia mediciones,
 * plantillas, reportes del laboratorio, resultados ni informes generados.
 */
export async function duplicateProject(id: string, userId: string): Promise<{ id: string; href: string; nombre: string }> {
  const p = await getProject(id);
  const copiadas: string[] = [];
  const copiarFoto = async (kind: FileKind, key: string | null, scope: string) => {
    if (!key) return null;
    const ext = key.split(".").pop() ?? "jpg";
    const nueva = newKey(kind, scope, ext);
    try {
      await copyObject(key, nueva);
    } catch {
      return null; // una foto que ya no existe no impide duplicar
    }
    copiadas.push(nueva);
    return nueva;
  };

  const informe = { ...p.informe };
  for (const c of CAMPOS_NUEVOS) delete informe[c];
  const nombre = `${p.nombre} (copia)`;

  try {
    return await db.transaction(async (tx) => {
      const [nuevo] = await tx
        .insert(projects)
        .values({
          nombre: nombre.slice(0, 255),
          tipo: p.tipo,
          cliente: p.cliente,
          codigoInforme: "",
          createdBy: userId,
          informe,
          vertimiento: p.vertimiento,
        })
        .returning({ id: projects.id, tipo: projects.tipo });

      if (p.tipo === "ambiental" || p.tipo === "emision") {
        const pts = await tx.select().from(points).where(eq(points.projectId, id)).orderBy(asc(points.orden));
        if (pts.length > 0) {
          const insertData = await Promise.all(
            pts.map(async (pt) => ({
              projectId: nuevo.id,
              orden: pt.orden,
              nombre: pt.nombre,
              sector: pt.sector,
              incertidumbre: pt.incertidumbre,
              este: pt.este,
              norte: pt.norte,
              altitud: pt.altitud,
              descripcion: pt.descripcion,
              fuentes: pt.fuentes,
              fotoKey: await copiarFoto("foto", pt.fotoKey, nuevo.id),
              fotoNombre: pt.fotoNombre,
            }))
          );
          await tx.insert(points).values(insertData);
        }
      } else if (p.tipo === "aire") {
        const est = await tx.select().from(airStations).where(eq(airStations.projectId, id)).orderBy(asc(airStations.numero));
        if (est.length > 0) {
          const insertData = await Promise.all(
            est.map(async (e) => ({
              projectId: nuevo.id,
              numero: e.numero,
              nombre: e.nombre,
              codigo: e.codigo,
              codigoAnla: e.codigoAnla,
              longitud: e.longitud,
              latitud: e.latitud,
              descripcion: e.descripcion,
              fotoKey: await copiarFoto("fotoAire", e.fotoKey, nuevo.id),
              fotoNombre: e.fotoNombre,
            }))
          );
          await tx.insert(airStations).values(insertData);
        }
      } else {
        const pts = await tx.select().from(waterPoints).where(eq(waterPoints.projectId, id)).orderBy(asc(waterPoints.orden));
        if (pts.length > 0) {
          const insertData = await Promise.all(
            pts.map(async (w) => ({
              projectId: nuevo.id,
              orden: w.orden,
              nombre: w.nombre,
              hojaFp: w.hojaFp,
              evaluar: w.evaluar,
              tipoAgua: w.tipoAgua,
              longitud: w.longitud,
              latitud: w.latitud,
              descripcion: w.descripcion,
              fotoKey: await copiarFoto("fotoAgua", w.fotoKey, nuevo.id),
              fotoNombre: w.fotoNombre,
            }))
          );
          await tx.insert(waterPoints).values(insertData);
        }
      }
      return { id: nuevo.id, href: hrefProyecto(nuevo), nombre };
    });
  } catch (e) {
    await Promise.all(copiadas.map((k) => deleteObject(k)));
    throw e;
  }
}
