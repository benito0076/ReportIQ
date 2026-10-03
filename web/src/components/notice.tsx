import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES = {
  info: { icon: Info, cls: "border-info-borde bg-info-suave text-info-texto" },
  success: { icon: CheckCircle2, cls: "border-exito-borde bg-exito-suave text-exito-texto" },
  warning: { icon: AlertTriangle, cls: "border-aviso-borde bg-aviso-suave text-aviso-texto" },
  error: { icon: AlertTriangle, cls: "border-peligro-borde bg-peligro-suave text-peligro-texto" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof STYLES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2 rounded-lg border px-3 py-2 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
    </div>
  );
}
