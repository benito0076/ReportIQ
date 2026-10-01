import type { UserRole } from "@/db/schema";

export interface Matriz {
  clave: "ruido" | "aire";
  titulo: string;
  descripcion: string;
  href: string;
  /** Mientras está en desarrollo solo la ve el administrador. */
  soloAdmin: boolean;
}

export const MATRICES: Matriz[] = [
  {
    clave: "ruido",
    titulo: "Ruido",
    descripcion: "Ruido ambiental y emisión de ruido (Resolución 0627 de 2006).",
    href: "/proyectos",
    soloAdmin: false,
  },
  {
    clave: "aire",
    titulo: "Calidad del aire",
    descripcion: "Informes de calidad del aire.",
    href: "/aire",
    soloAdmin: true,
  },
];

export function matricesVisibles(role: UserRole): Matriz[] {
  return MATRICES.filter((m) => !m.soloAdmin || role === "admin");
}
