"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { confirmUploadAction, prepareUploadAction } from "@/app/actions/uploads";
import { Button } from "@/components/ui/button";
import { UPLOAD_RULES } from "@/lib/files";

export type UploadTarget =
  | { kind: "memoria"; projectId: string; pointId: string; esquema: string; direccion: string }
  | { kind: "foto"; projectId: string; pointId: string }
  | { kind: "fotoAire"; projectId: string; stationId: string }
  | { kind: "meteo"; projectId: string }
  | { kind: "barrido"; projectId: string }
  | { kind: "aire"; projectId: string; plantilla: string }
  | { kind: "laboratorio"; projectId: string; pointId: string }
  | { kind: "fp004"; projectId: string }
  | { kind: "laboratorioLote"; projectId: string }
  | { kind: "fotoAgua"; projectId: string; pointId: string }
  | { kind: "plantilla" };

const MAX_PHOTO_SIDE = 1600;

/** Reduce las fotos grandes (celular) a JPEG de 1600 px: el informe no necesita más. */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function put(url: string, file: File, contentType: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("red"));
    xhr.send(file);
  });
}

/** Sube un archivo directamente al almacenamiento. Devuelve un mensaje de error o null. */
export async function uploadFile(
  target: UploadTarget,
  original: File,
  onProgress?: (p: number) => void,
): Promise<string | null> {
  const file = target.kind === "foto" || target.kind === "fotoAire" || target.kind === "fotoAgua" ? await shrinkPhoto(original) : original;
  const rule = UPLOAD_RULES[target.kind];
  if (file.size > rule.maxBytes) return `"${original.name}" supera el tamaño máximo (${rule.maxBytes / 1024 / 1024} MB).`;
  const prepared = await prepareUploadAction(target, file.name, file.size);
  if (!prepared.ok) return prepared.error;
  try {
    await put(prepared.url, file, prepared.contentType, onProgress);
  } catch {
    return `No se pudo subir "${original.name}". Revise su conexión e intente de nuevo.`;
  }
  const confirmed = await confirmUploadAction(target, prepared.key, original.name);
  return confirmed.ok ? null : confirmed.error;
}

export function UploadButton({
  target,
  label = "Subir",
  variant = "outline",
  size = "sm",
  className,
}: {
  target: UploadTarget;
  label?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "xs" | "default";
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProgress(0);
    const error = await uploadFile(target, file, setProgress);
    setProgress(null);
    if (error) window.alert(error);
    router.refresh();
  }

  return (
    <>
      <input ref={input} type="file" hidden accept={UPLOAD_RULES[target.kind].accept} onChange={onChange} />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={progress !== null}
        onClick={() => input.current?.click()}
      >
        {progress !== null ? <Loader2 className="animate-spin" /> : <Upload />}
        {progress !== null ? `${Math.round(progress * 100)} %` : label}
      </Button>
    </>
  );
}
