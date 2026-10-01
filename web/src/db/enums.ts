export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ESQUEMAS = ["DH", "DNH", "NDH", "NDNH"] as const;
export type Esquema = (typeof ESQUEMAS)[number];

export const ESQUEMA_LABELS: Record<Esquema, string> = {
  DH: "Diurno - Día hábil",
  DNH: "Diurno - Día no hábil",
  NDH: "Nocturno - Día hábil",
  NDNH: "Nocturno - Día no hábil",
};

export const PROJECT_TYPES = ["ambiental", "emision", "aire"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
/** Tipos de la matriz Ruido (los de calidad del aire viven en /aire). */
export const RUIDO_TYPES = ["ambiental", "emision"] as const;
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  ambiental: "Ruido ambiental",
  emision: "Emisión de ruido",
  aire: "Calidad del aire",
};

/** Plantillas de procesamiento de calidad del aire (una por contaminante; FP-021 para los automáticos). */
export const PLANTILLAS_AIRE = ["PM10", "PM2.5", "SO2", "COV", "AUTOMATICOS"] as const;
export type PlantillaAire = (typeof PLANTILLAS_AIRE)[number];
export const PLANTILLA_AIRE_LABELS: Record<PlantillaAire, { titulo: string; formato: string }> = {
  PM10: { titulo: "PM10 – equipos de alto volumen", formato: "FP-031" },
  "PM2.5": { titulo: "PM2.5 – equipos de bajo volumen", formato: "FP-032" },
  SO2: { titulo: "Dióxido de azufre (SO2) – manual", formato: "FP-033" },
  COV: { titulo: "Compuestos orgánicos volátiles (COV)", formato: "FP-035" },
  AUTOMATICOS: { titulo: "Equipos automáticos (CO, NO2, O3)", formato: "FP-021" },
};

export const DIRECCIONES = ["Vertical", "Norte", "Sur", "Este", "Oeste"] as const;
/** Emisión: medición con la fuente en operación y, opcional, ruido residual (fuente apagada). */
export const RANURAS_EMISION = ["Emision", "Residual"] as const;
export type RanuraEmision = (typeof RANURAS_EMISION)[number];
export type Direccion = (typeof DIRECCIONES)[number] | RanuraEmision;
export const DIRECCIONES_Y_RANURAS = [...DIRECCIONES, ...RANURAS_EMISION] as const;

export const CONDICIONES_BARRIDO = ["Encendido", "Apagado"] as const;
export type CondicionBarrido = (typeof CONDICIONES_BARRIDO)[number];

/** Eventos del registro de actividad (menú Actividad, solo administradores). */
export const ACTIVITY_EVENTS = [
  "login_ok",
  "login_fallido",
  "logout",
  "proyecto_creado",
  "proyecto_eliminado",
  "informe_generado",
  "informe_descargado",
  "informe_eliminado",
  "usuario_creado",
  "usuario_eliminado",
  "rol_cambiado",
  "contrasena_restablecida",
  "ajustes_cambiados",
  "plantilla_subida",
  "plantilla_quitada",
  "equipo_eliminado",
] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

export const ACTIVITY_LABELS: Record<ActivityEvent, string> = {
  login_ok: "Inicio de sesión",
  login_fallido: "Intento de inicio de sesión fallido",
  logout: "Cierre de sesión",
  proyecto_creado: "Proyecto creado",
  proyecto_eliminado: "Proyecto eliminado",
  informe_generado: "Informe generado",
  informe_descargado: "Informe descargado",
  informe_eliminado: "Informe eliminado",
  usuario_creado: "Usuario creado",
  usuario_eliminado: "Usuario eliminado",
  rol_cambiado: "Rol cambiado",
  contrasena_restablecida: "Contraseña restablecida",
  ajustes_cambiados: "Ajustes modificados",
  plantilla_subida: "Plantilla Word subida",
  plantilla_quitada: "Plantilla Word quitada",
  equipo_eliminado: "Equipo eliminado",
};

export const REPORT_KINDS = ["word", "excel", "anexos"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABELS: Record<ReportKind, string> = {
  word: "Informe Word",
  excel: "Resultados Excel",
  anexos: "Gráficas e isófonas (ZIP)",
};

/** Emisión no lleva mapas de isófonas: su ZIP solo tiene gráficas. */
export function reportLabel(kind: ReportKind, tipo: ProjectType): string {
  return kind === "anexos" && tipo === "emision" ? "Gráficas (ZIP)" : REPORT_LABELS[kind];
}
