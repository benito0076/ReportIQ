export interface Matriz {
  clave: "ruido" | "aire" | "vertimientos";
  titulo: string;
  descripcion: string;
  href: string;
}

export const MATRICES: Matriz[] = [
  {
    clave: "ruido",
    titulo: "Ruido",
    descripcion: "Ruido ambiental y emisión de ruido (Resolución 0627 de 2006).",
    href: "/proyectos",
  },
  {
    clave: "aire",
    titulo: "Calidad del aire",
    descripcion: "Calidad del aire frente a la Resolución 2254 de 2017.",
    href: "/aire",
  },
  {
    clave: "vertimientos",
    titulo: "Vertimientos (agua)",
    descripcion: "Caracterización de vertimientos frente a la Resolución 0631 de 2015.",
    href: "/vertimientos",
  },
];
