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

export const DIRECCIONES = ["Vertical", "Norte", "Sur", "Este", "Oeste"] as const;
export type Direccion = (typeof DIRECCIONES)[number];

export const REPORT_KINDS = ["word", "excel", "anexos"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABELS: Record<ReportKind, string> = {
  word: "Informe Word",
  excel: "Resultados Excel",
  anexos: "Gráficas e isófonas (ZIP)",
};
