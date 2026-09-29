"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileArchive, FileSpreadsheet, FileText, Loader2, Play } from "lucide-react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { reportLabel, type ProjectType, type ReportKind } from "@/db/enums";

async function post(url: string, body?: unknown): Promise<{ error?: string; advertencias?: unknown }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? `Error del servidor (HTTP ${res.status}).` };
    return data;
  } catch {
    return { error: "No se pudo contactar el servidor. Revise su conexión." };
  }
}

export function ProcessButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <div>
        <Button
          disabled={pending || disabled}
          onClick={async () => {
            setPending(true);
            setError(null);
            const res = await post(`/api/proyectos/${projectId}/procesar`);
            setPending(false);
            if (res.error) setError(res.error);
            router.refresh();
          }}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          {pending ? "Procesando…" : "Procesar proyecto"}
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

const ICONS: Record<ReportKind, typeof FileText> = { word: FileText, excel: FileSpreadsheet, anexos: FileArchive };

export function GenerateButtons({
  projectId,
  tipo,
  disabled,
}: {
  projectId: string;
  tipo: ProjectType;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ReportKind | null>(null);
  const [result, setResult] = useState<{ tone: "error" | "success" | "warning"; text: string; items?: string[] } | null>(null);

  async function generate(kind: ReportKind) {
    setPending(kind);
    setResult(null);
    const res = await post(`/api/proyectos/${projectId}/informes`, { kind });
    setPending(null);
    if (res.error) {
      setResult({ tone: "error", text: res.error });
    } else {
      const adv = Array.isArray(res.advertencias) ? (res.advertencias as string[]) : [];
      setResult({
        tone: adv.length ? "warning" : "success",
        text: `${reportLabel(kind, tipo)} generado. Descárguelo en el historial de abajo.`,
        items: adv,
      });
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {(["word", "excel", "anexos"] as const).map((k) => {
          const Icon = ICONS[k];
          return (
            <Button key={k} variant={k === "word" ? "default" : "outline"} disabled={pending !== null || disabled} onClick={() => generate(k)}>
              {pending === k ? <Loader2 className="animate-spin" /> : <Icon />}
              {reportLabel(k, tipo)}
            </Button>
          );
        })}
      </div>
      {pending && (
        <p className="text-sm text-muted-foreground">
          Generando…{" "}
          {tipo === "ambiental" ? "El informe Word y los mapas de isófonas pueden" : "El informe Word puede"} tardar uno
          o dos minutos (se descargan las imágenes satelitales).
        </p>
      )}
      {result && (
        <Notice tone={result.tone} title={result.text}>
          {result.items && result.items.length > 0 && (
            <ul className="list-disc pl-4">
              {result.items.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
}
