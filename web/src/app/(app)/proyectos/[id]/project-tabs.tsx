"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/proyectos/${projectId}`;
  const tabs = [
    { href: base, label: "1. Proyecto y puntos", active: pathname === base || pathname.startsWith(`${base}/puntos`) },
    { href: `${base}/memorias`, label: "2. Memorias del sonómetro", active: pathname.startsWith(`${base}/memorias`) },
    { href: `${base}/resultados`, label: "3. Resultados e informes", active: pathname.startsWith(`${base}/resultados`) },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 py-2 whitespace-nowrap text-muted-foreground hover:text-foreground",
            t.active && "border-foreground font-medium text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
