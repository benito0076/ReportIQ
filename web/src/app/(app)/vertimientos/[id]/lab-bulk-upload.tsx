"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import { confirmUploadAction, prepareUploadAction } from "@/app/actions/uploads";
import { Button } from "@/components/ui/button";
import { UPLOAD_RULES } from "@/lib/files";
import { cn } from "@/lib/utils";

interface Resultado {
  archivo: string;
  ok: boolean;
  texto: string;
}

async function subir(projectId: string, file: File): Promise<Resultado> {
  const target = { kind: "laboratorioLote" as const, projectId };
  const rule = UPLOAD_RULES.laboratorioLote;
  if (file.size > rule.maxBytes) {
    return { archivo: file.name, ok: false, texto: `supera el tamaño máximo (${rule.maxBytes / 1024 / 1024} MB)` };
  }
  const prep = await prepareUploadAction(target, file.name, file.size);
  if (!prep.ok) return { archivo: file.name, ok: false, texto: prep.error };
  const put = await fetch(prep.url, { method: "PUT", headers: { "Content-Type": prep.contentType }, body: file }).catch(
    () => null,
  );
  if (!put?.ok) return { archivo: file.name, ok: false, texto: "no se pudo subir; revise su conexión" };
  const conf = await confirmUploadAction(target, prep.key, file.name);
  if (!conf.ok) return { archivo: file.name, ok: false, texto: conf.error };
  return { archivo: file.name, ok: true, texto: ("mensaje" in conf && conf.mensaje) || "asignado" };
}

/**
 * Subida de varios reportes del laboratorio a la vez: cada PDF se asigna al punto
 * con el nombre que trae el reporte (o crea el punto si no existe).
 */
export function LabBulkUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  async function procesar(lista: FileList | File[]) {
    const pdfs = Array.from(lista).filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    const otros = Array.from(lista).filter((f) => !pdfs.includes(f));
    if (!pdfs.length && !otros.length) return;
    setResultados(otros.map((f) => ({ archivo: f.name, ok: false, texto: "no es un PDF" })));
    setPendientes(pdfs.map((f) => f.name));
    // Uno a la vez: cada reporte puede crear un punto y el orden debe ser estable.
    for (const f of pdfs) {
      const r = await subir(projectId, f);
      setResultados((prev) => [...prev, r]);
      setPendientes((prev) => prev.filter((n) => n !== f.name));
    }
    router.refresh();
  }

  const ocupado = pendientes.length > 0;
  return (
    <div className="grid gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (!ocupado) void procesar(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm",
          encima ? "border-primary bg-primary/5" : "bg-muted/30",
        )}
      >
        <div className="flex items-start gap-2">
          <FileUp className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-medium">Subir varios reportes del laboratorio</div>
            <div className="text-xs text-muted-foreground">
              Arrastre los PDF aquí o selecciónelos: cada uno se asigna al punto con el nombre que trae el reporte, y si
              el punto no existe se crea.
            </div>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={UPLOAD_RULES.laboratorioLote.accept}
          onChange={(e) => {
            const files = e.target.files;
            if (files) void procesar(Array.from(files));
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => input.current?.click()}>
          {ocupado ? <Loader2 className="animate-spin" /> : <FileUp />}
          {ocupado ? `Leyendo ${pendientes.length}…` : "Seleccionar PDF"}
        </Button>
      </div>
      {(resultados.length > 0 || ocupado) && (
        <ul className="grid gap-1 text-sm">
          {resultados.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              )}
              <span>
                <span className="font-medium">{r.archivo}</span>: {r.texto}
              </span>
            </li>
          ))}
          {pendientes.map((n) => (
            <li key={n} className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
