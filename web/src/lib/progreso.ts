/**
 * Avance de un proyecto de calidad del aire o de vertimientos: pasos (barra de
 * progreso arriba de la página) y lista de verificación antes de generar el
 * informe. Funciones puras: la página les pasa los datos que ya consultó.
 */

export type EstadoPaso = "ok" | "pendiente" | "opcional";

export interface Paso {
  titulo: string;
  estado: EstadoPaso;
  detalle: string;
  /** id de la tarjeta de la página (enlace #ancla). */
  ancla: string;
}

export interface Aviso {
  texto: string;
  ancla: string;
  /** "bloquea": no se puede procesar; "revisar": el informe sale incompleto. */
  nivel: "bloquea" | "revisar";
}

export interface Revision {
  pasos: Paso[];
  avisos: Aviso[];
}

const vacio = (v: string | null | undefined) => !v || !v.trim();

function nombres(lista: string[], max = 3): string {
  const n = lista.length;
  if (n <= max) return lista.join(", ");
  return `${lista.slice(0, max).join(", ")} y ${n - max} más`;
}

interface Firmas {
  elaboroNombre: string;
}

interface InformeDatos {
  municipio?: string;
  departamento?: string;
  areaEstudio?: string;
  clienteActividad?: string;
  laboratorioSubcontratado?: string;
}

/** «Elaboró» sale del perfil de quien genera el informe (o de Ajustes); «Autorizó» lo firma el aprobador. */
function avisosComunes(firmas: Firmas, ancla: string): Aviso[] {
  return vacio(firmas.elaboroNombre)
    ? [{ texto: "Falta la firma «Elaboró»: escriba su nombre y cargo en Mi perfil.", ancla, nivel: "revisar" }]
    : [];
}

// ------------------------------------------------------------------ vertimientos
export interface PuntoAgua {
  nombre: string;
  informeKey: string | null;
  fotoKey: string | null;
  latitud: string;
  longitud: string;
  descripcion: string;
}

export function revisarVertimiento(d: {
  cliente: string;
  codigo: string;
  actividades: number;
  puntos: PuntoAgua[];
  fp004: boolean;
  informe: InformeDatos;
  procesado: boolean;
  /** Puntos cuyo reporte del laboratorio trae otro nombre (resultados del último procesamiento). */
  cruzados: { punto: string; laboratorio: string }[];
  subcontratados: boolean;
  firmas: Firmas;
}): Revision {
  const conReporte = d.puntos.filter((p) => p.informeKey);
  const pasos: Paso[] = [
    {
      titulo: "Datos",
      estado: vacio(d.cliente) || vacio(d.codigo) ? "pendiente" : "ok",
      detalle: vacio(d.cliente) ? "Falta el cliente" : vacio(d.codigo) ? "Falta el código" : d.codigo,
      ancla: "paso-datos",
    },
    {
      titulo: "Norma",
      estado: d.actividades > 0 ? "ok" : "pendiente",
      detalle: d.actividades > 0 ? `${d.actividades} actividad${d.actividades === 1 ? "" : "es"}` : "Sin actividades",
      ancla: "paso-norma",
    },
    {
      titulo: "Puntos",
      estado: d.puntos.length > 0 && conReporte.length === d.puntos.length ? "ok" : "pendiente",
      detalle: d.puntos.length ? `${conReporte.length}/${d.puntos.length} con reporte` : "Sin puntos",
      ancla: "paso-puntos",
    },
    {
      titulo: "FP-004",
      estado: d.fp004 ? "ok" : "opcional",
      detalle: d.fp004 ? "Cargada" : "Opcional",
      ancla: "paso-campo",
    },
    {
      titulo: "Informe",
      estado: vacio(d.informe.municipio) ? "opcional" : "ok",
      detalle: vacio(d.informe.municipio) ? "Del reporte" : (d.informe.municipio ?? ""),
      ancla: "paso-informe",
    },
    {
      titulo: "Procesado",
      estado: d.procesado ? "ok" : "pendiente",
      detalle: d.procesado ? "Al día" : "Pendiente",
      ancla: "paso-procesar",
    },
  ];

  const avisos: Aviso[] = [];
  if (d.puntos.length === 0) {
    avisos.push({ texto: "Agregue los puntos de muestreo.", ancla: "paso-puntos", nivel: "bloquea" });
  } else if (conReporte.length === 0) {
    avisos.push({ texto: "Suba el reporte del laboratorio (PDF) de al menos un punto.", ancla: "paso-puntos", nivel: "bloquea" });
  }
  const sinReporte = d.puntos.filter((p) => !p.informeKey).map((p) => p.nombre);
  if (sinReporte.length && conReporte.length) {
    avisos.push({ texto: `Puntos sin reporte del laboratorio: ${nombres(sinReporte)}.`, ancla: "paso-puntos", nivel: "revisar" });
  }
  for (const c of d.cruzados) {
    avisos.push({
      texto: `El reporte asignado a «${c.punto}» es del punto «${c.laboratorio}»: revise que no estén cruzados.`,
      ancla: "paso-puntos",
      nivel: "revisar",
    });
  }
  if (d.actividades === 0) {
    avisos.push({ texto: "Sin actividades de la Res. 0631: los resultados no se comparan con la norma.", ancla: "paso-norma", nivel: "revisar" });
  }
  const sinCoord = d.puntos.filter((p) => vacio(p.latitud) || vacio(p.longitud)).map((p) => p.nombre);
  if (sinCoord.length) {
    avisos.push({ texto: `Sin coordenadas (tablas y mapa de localización): ${nombres(sinCoord)}.`, ancla: "paso-puntos", nivel: "revisar" });
  }
  const sinDesc = d.puntos.filter((p) => vacio(p.descripcion)).map((p) => p.nombre);
  if (sinDesc.length) {
    avisos.push({ texto: `Sin descripción: ${nombres(sinDesc)}.`, ancla: "paso-puntos", nivel: "revisar" });
  }
  if (d.puntos.length && !d.puntos.some((p) => p.fotoKey)) {
    avisos.push({ texto: "Ningún punto tiene foto (portada y descripción de los puntos).", ancla: "paso-puntos", nivel: "revisar" });
  }
  if (!d.fp004) {
    avisos.push({ texto: "Sin FP-004: el informe no lleva tablas ni gráficas de campo (caudal, pH, temperatura…).", ancla: "paso-campo", nivel: "revisar" });
  }
  if (vacio(d.informe.clienteActividad)) {
    avisos.push({ texto: "Falta la actividad del cliente (tabla de información del cliente).", ancla: "paso-informe", nivel: "revisar" });
  }
  if (d.subcontratados && vacio(d.informe.laboratorioSubcontratado)) {
    avisos.push({ texto: "Hay ensayos subcontratados: indique el laboratorio subcontratado.", ancla: "paso-informe", nivel: "revisar" });
  }
  avisos.push(...avisosComunes(d.firmas, "paso-informe"));
  return { pasos, avisos };
}

// ------------------------------------------------------------------ calidad del aire
export interface EstacionAire {
  numero: number;
  nombre: string;
  latitud: string;
  longitud: string;
  descripcion: string;
  fotoKey: string | null;
}

export function revisarAire(d: {
  cliente: string;
  codigo: string;
  estaciones: EstacionAire[];
  plantillas: number;
  meteo: boolean;
  informe: InformeDatos;
  procesado: boolean;
  firmas: Firmas;
}): Revision {
  const nombre = (e: EstacionAire) => e.nombre.trim() || `Estación ${e.numero}`;
  const pasos: Paso[] = [
    {
      titulo: "Datos",
      estado: vacio(d.cliente) || vacio(d.codigo) ? "pendiente" : "ok",
      detalle: vacio(d.cliente) ? "Falta el cliente" : vacio(d.codigo) ? "Falta el código" : d.codigo,
      ancla: "paso-datos",
    },
    {
      titulo: "Estaciones",
      estado: d.estaciones.length ? "ok" : "opcional",
      detalle: d.estaciones.length ? `${d.estaciones.length}` : "De las plantillas",
      ancla: "paso-estaciones",
    },
    {
      titulo: "Plantillas",
      estado: d.plantillas > 0 ? "ok" : "pendiente",
      detalle: `${d.plantillas}/5`,
      ancla: "paso-plantillas",
    },
    {
      titulo: "Informe",
      estado: vacio(d.informe.areaEstudio) ? "pendiente" : "ok",
      detalle: vacio(d.informe.areaEstudio) ? "Falta el área" : "Completo",
      ancla: "paso-informe",
    },
    {
      titulo: "Procesado",
      estado: d.procesado ? "ok" : "pendiente",
      detalle: d.procesado ? "Al día" : "Pendiente",
      ancla: "paso-procesar",
    },
  ];
  const avisos: Aviso[] = [];
  if (d.plantillas === 0) {
    avisos.push({ texto: "Suba al menos una plantilla de procesamiento (FP).", ancla: "paso-plantillas", nivel: "bloquea" });
  }
  const sinCoord = d.estaciones.filter((e) => vacio(e.latitud) || vacio(e.longitud)).map(nombre);
  if (sinCoord.length) {
    avisos.push({ texto: `Estaciones sin coordenadas (tabla y mapa): ${nombres(sinCoord)}.`, ancla: "paso-estaciones", nivel: "revisar" });
  }
  const sinDesc = d.estaciones.filter((e) => vacio(e.descripcion)).map(nombre);
  if (sinDesc.length) {
    avisos.push({ texto: `Estaciones sin descripción: ${nombres(sinDesc)}.`, ancla: "paso-estaciones", nivel: "revisar" });
  }
  const sinFoto = d.estaciones.filter((e) => !e.fotoKey).map(nombre);
  if (sinFoto.length) {
    avisos.push({ texto: `Estaciones sin foto (registro fotográfico): ${nombres(sinFoto)}.`, ancla: "paso-estaciones", nivel: "revisar" });
  }
  if (!d.meteo) {
    avisos.push({ texto: "Sin datos meteorológicos: el capítulo de meteorología queda incompleto.", ancla: "paso-plantillas", nivel: "revisar" });
  }
  if (vacio(d.informe.areaEstudio)) {
    avisos.push({ texto: "Falta el área de estudio (se usará el nombre del proyecto).", ancla: "paso-informe", nivel: "revisar" });
  }
  if (vacio(d.informe.municipio) || vacio(d.informe.departamento)) {
    avisos.push({ texto: "Falta el municipio o el departamento.", ancla: "paso-informe", nivel: "revisar" });
  }
  avisos.push(...avisosComunes(d.firmas, "paso-informe"));
  return { pasos, avisos };
}
