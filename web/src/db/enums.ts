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

export const PROJECT_TYPES = ["ambiental", "emision"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  ambiental: "Ruido ambiental",
  emision: "Emisión de ruido",
};

export const DIRECCIONES = ["Vertical", "Norte", "Sur", "Este", "Oeste"] as const;
/** Emisión: medición con la fuente en operación y, opcional, ruido residual (fuente apagada). */
export const RANURAS_EMISION = ["Emision", "Residual"] as const;
export type RanuraEmision = (typeof RANURAS_EMISION)[number];
export type Direccion = (typeof DIRECCIONES)[number] | RanuraEmision;
export const DIRECCIONES_Y_RANURAS = [...DIRECCIONES, ...RANURAS_EMISION] as const;

export const CONDICIONES_BARRIDO = ["Encendido", "Apagado"] as const;
export type CondicionBarrido = (typeof CONDICIONES_BARRIDO)[number];

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
