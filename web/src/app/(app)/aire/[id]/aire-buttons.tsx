"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Play } from "lucide-react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";

async function post(url: string): Promise<{ error?: string; advertencias?: unknown }> {
  try {
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? `Error del servidor (HTTP ${res.status}).` };
    return data;
  } catch {
    return { error: "No se pudo contactar el servidor. Revise su conexión." };
  }
}

export function AireButtons({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"procesar" | "excel" | null>(null);
  const [result, setResult] = useState<{ tone: "error" | "success" | "warning"; text: string; items?: string[] } | null>(null);

  async function run(kind: "procesar" | "excel") {
    setPending(kind);
    setResult(null);
    const res = await post(`/api/aire/${projectId}/${kind === "procesar" ? "procesar" : "informes"}`);
    setPending(null);
    if (res.error) {
      setResult({ tone: "error", text: res.error });
    } else if (kind === "excel") {
      const adv = Array.isArray(res.advertencias) ? (res.advertencias as string[]) : [];
      setResult({
        tone: adv.length ? "warning" : "success",
        text: "Excel de resultados generado. Descárguelo en el historial de abajo.",
        items: adv,
      });
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending !== null || disabled} onClick={() => run("procesar")}>
          {pending === "procesar" ? <Loader2 className="animate-spin" /> : <Play />}
          {pending === "procesar" ? "Procesando…" : "Procesar proyecto"}
        </Button>
        <Button variant="outline" disabled={pending !== null || disabled} onClick={() => run("excel")}>
          {pending === "excel" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Resultados Excel
        </Button>
      </div>
      {pending && <p className="text-sm text-muted-foreground">Leyendo las plantillas… puede tardar unos segundos.</p>}
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
