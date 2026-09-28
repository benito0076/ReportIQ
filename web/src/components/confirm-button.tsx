"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = void | { error?: string } | undefined;

/**
 * Botón que pide confirmación y ejecuta una Server Action. Si la acción
 * devuelve { error }, se muestra en un aviso.
 */
export function ConfirmButton({
  action,
  confirm,
  children,
  variant = "ghost",
  size = "sm",
  title,
}: {
  action: () => Promise<Result>;
  confirm?: string;
  children: React.ReactNode;
  variant?: "ghost" | "outline" | "destructive" | "default";
  size?: "sm" | "default" | "icon-sm" | "xs";
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res && res.error) window.alert(res.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : children}
    </Button>
  );
}
