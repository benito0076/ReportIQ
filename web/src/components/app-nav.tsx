"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Enlace {
  href: string;
  label: string;
  descripcion?: string;
}

/** Entrada del menú: un enlace o un grupo con submenú. */
export type ItemMenu = Enlace | { label: string; items: Enlace[] };

const esGrupo = (i: ItemMenu): i is { label: string; items: Enlace[] } => "items" in i;

function activo(pathname: string, href: string) {
  const ruta = href.split("?")[0];
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

const claseItem = (on: boolean) =>
  cn(
    "relative rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    on &&
      "font-medium text-foreground after:absolute after:inset-x-2.5 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-marca",
  );

function Grupo({ item, pathname }: { item: { label: string; items: Enlace[] }; pathname: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);
  const on = item.items.some((e) => activo(pathname, e.href));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(claseItem(on), "inline-flex items-center gap-1")}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        {item.label}
        <ChevronDown className={cn("size-3.5 transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <div className="absolute top-full left-0 z-40 mt-2 w-64 rounded-lg border bg-popover p-1 shadow-lg">
          {item.items.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setAbierto(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                activo(pathname, e.href) && "bg-muted font-medium",
              )}
            >
              {e.label}
              {e.descripcion && <span className="block text-xs text-muted-foreground">{e.descripcion}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Menú principal: barra en escritorio y panel desplegable en el celular. */
export function AppNav({ items }: { items: ItemMenu[] }) {
  const pathname = usePathname();
  // El panel móvil se cierra solo al navegar: queda abierto mientras la ruta sea la misma.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const movil = abiertoEn === pathname;

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Menú principal">
        {items.map((i) =>
          esGrupo(i) ? (
            <Grupo key={i.label} item={i} pathname={pathname} />
          ) : (
            <Link key={i.href} href={i.href} className={claseItem(activo(pathname, i.href))}>
              {i.label}
            </Link>
          ),
        )}
      </nav>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={movil ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={movil}
        onClick={() => setAbiertoEn(movil ? null : pathname)}
      >
        {movil ? <X /> : <Menu />}
      </Button>
      {movil && (
        // El encabezado (sticky con desenfoque) es el bloque contenedor: el panel se ancla debajo de él.
        <div className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-3.5rem)] overflow-y-auto border-t bg-background p-4 md:hidden">
          <nav className="grid gap-4 text-base" aria-label="Menú principal">
            {items.map((i) =>
              esGrupo(i) ? (
                <div key={i.label} className="grid gap-1">
                  <div className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{i.label}</div>
                  {i.items.map((e) => (
                    <Link
                      key={e.href}
                      href={e.href}
                      className={cn("rounded-md px-3 py-2 hover:bg-muted", activo(pathname, e.href) && "bg-muted font-medium")}
                    >
                      {e.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cn("rounded-md px-3 py-2 hover:bg-muted", activo(pathname, i.href) && "bg-muted font-medium")}
                >
                  {i.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      )}
    </>
  );
}
