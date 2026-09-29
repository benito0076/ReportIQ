"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Files, Loader2 } from "lucide-react";
import { uploadFile } from "@/components/upload";
import { Button } from "@/components/ui/button";
import { UPLOAD_RULES } from "@/lib/files";

/** Sube varias memorias del barrido a la vez; cada archivo es un barrido ("Barrido 5.xlsx"). */
export function BarridoUpload({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;
    const problemas: string[] = [];
    for (const [i, f] of files.entries()) {
      setStatus(`${i + 1}/${files.length}`);
      const error = await uploadFile({ kind: "barrido", projectId }, f);
      if (error) problemas.push(error);
    }
    setStatus(null);
    router.refresh();
    if (problemas.length) window.alert(problemas.join("\n"));
  }

  return (
    <>
      <input ref={input} type="file" hidden multiple accept={UPLOAD_RULES.barrido.accept} onChange={onChange} />
      <Button type="button" variant="outline" size="sm" disabled={status !== null} onClick={() => input.current?.click()}>
        {status ? <Loader2 className="animate-spin" /> : <Files />}
        {status ?? "Subir memorias del barrido"}
      </Button>
    </>
  );
}
