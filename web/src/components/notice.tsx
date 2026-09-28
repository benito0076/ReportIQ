import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES = {
  info: { icon: Info, cls: "border-sky-200 bg-sky-50 text-sky-900" },
  success: { icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  warning: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-900" },
  error: { icon: AlertTriangle, cls: "border-red-200 bg-red-50 text-red-800" },
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
