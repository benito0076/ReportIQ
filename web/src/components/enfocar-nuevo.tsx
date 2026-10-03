"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Con ?nuevo=1 (desde «Nuevo proyecto»), lleva el cursor al nombre del formulario de creación. */
export function EnfocarNuevo() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const nuevo = params.get("nuevo");
  useEffect(() => {
    if (!nuevo) return;
    const campo = document.querySelector<HTMLInputElement>("#nuevo #nombre");
    campo?.scrollIntoView({ block: "center", behavior: "smooth" });
    campo?.focus({ preventScroll: true });
    const resto = new URLSearchParams(params);
    resto.delete("nuevo");
    const q = resto.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [nuevo, params, pathname, router]);
  return null;
}
