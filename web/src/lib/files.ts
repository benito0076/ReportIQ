import type { FileKind } from "./storage";

/** Reglas de subida por tipo de archivo (se validan en cliente y servidor). */
export interface UploadRule {
  maxBytes: number;
  /** Atributo `accept` del <input type="file">. */
  accept: string;
  /** Firma binaria esperada: "zip" (xlsx/docx) o "image" (jpeg/png). */
  signature: "zip" | "image";
  label: string;
}

const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<Exclude<FileKind, "informe">, UploadRule> = {
  memoria: {
    maxBytes: 40 * MB,
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signature: "zip",
    label: "memoria del sonómetro (.xlsx)",
  },
  foto: {
    maxBytes: 15 * MB,
    accept: "image/jpeg,image/png",
    signature: "image",
    label: "foto (JPG o PNG)",
  },
  plantilla: {
    maxBytes: 40 * MB,
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: "zip",
    label: "plantilla Word (.docx)",
  },
};

export const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
} as const;

export type SniffedType = "zip" | "jpg" | "png";

/** Identifica el archivo por su firma binaria (no se confía en la extensión). */
export function sniff(bytes: Uint8Array): SniffedType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (starts([0xff, 0xd8, 0xff])) return "jpg";
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "png";
  return null;
}

export function matchesRule(type: SniffedType | null, rule: UploadRule): boolean {
  if (!type) return false;
  return rule.signature === "zip" ? type === "zip" : type === "jpg" || type === "png";
}

/** Extensión para la clave de almacenamiento según el tipo de archivo. */
export function extensionFor(kind: Exclude<FileKind, "informe">, fileName: string): string {
  if (kind === "memoria") return "xlsx";
  if (kind === "plantilla") return "docx";
  return /\.png$/i.test(fileName) ? "png" : "jpg";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / MB).toFixed(1).replace(".", ",")} MB`;
}
