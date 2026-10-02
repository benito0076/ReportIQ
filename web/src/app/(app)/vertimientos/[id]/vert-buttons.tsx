"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Play } from "lucide-react";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";

type Accion = "procesar" | "excel";

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

export function VertButtons({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Accion | null>(null);
  const [result, setResult] = useState<{ tone: "error" | "success" | "warning"; text: string; items?: string[] } | null>(null);

  async function run(accion: Accion) {
    setPending(accion);
    setResult(null);
    const res =
      accion === "procesar"
        ? await post(`/api/vertimientos/${projectId}/procesar`)
        : await post(`/api/vertimientos/${projectId}/informes`, { kind: accion });
    setPending(null);
    if (res.error) {
      setResult({ tone: "error", text: res.error });
    } else if (accion !== "procesar") {
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
        <Button variant="outline" disabled={pending !== null || disabled} onClick={() => run("procesar")}>
          {pending === "procesar" ? <Loader2 className="animate-spin" /> : <Play />}
          {pending === "procesar" ? "Procesando…" : "Procesar proyecto"}
        </Button>
        <Button variant="outline" disabled={pending !== null || disabled} onClick={() => run("excel")}>
          {pending === "excel" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Resultados Excel
        </Button>
      </div>
      {pending && (
        <p className="text-sm text-muted-foreground">
          Leyendo los reportes del laboratorio y la FP-004… puede tardar unos segundos.
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
