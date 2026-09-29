import type { Direccion, Esquema } from "@/db/enums";

/** Estructura devuelta por POST /v1/procesar del motor (engine/service.py). */
export interface ResultadoDireccion {
  direccion: Direccion;
  inicio: string | null;
  fin: string | null;
  lpico: number | null;
  lmax: number | null;
  lmin: number | null;
  l90: number | null;
  laeq: number | null;
  laieq: number | null;
  li: number | null;
  ki: number | null;
  kt: number | null;
  ks: number | null;
  correccion_pantalla: number | null;
  correccion: number | null;
  l90_corregido: number | null;
  lraeq_corregido: number | null;
  tipo_ajuste: string;
  numero_serie: string | null;
  modelo: string | null;
}

export interface ResultadoEsquema {
  lraeq_resultante: number | null;
  inicio: string | null;
  fin: string | null;
  direcciones: ResultadoDireccion[];
}

export interface ResultadoPunto {
  no_punto: number;
  nombre: string;
  sector: string;
  incertidumbre: number;
  estandar_diurno: number | null;
  estandar_nocturno: number | null;
  cumple: Record<Esquema, "Si" | "No" | null>;
  esquemas: Partial<Record<Esquema, ResultadoEsquema>>;
}

interface Comunes {
  advertencias: { punto: string; esquema: string; direccion: string; mensaje: string }[];
  equipos_detectados: { serial: string; modelo: string | null }[];
}

/** Resultados de ruido ambiental (los guardados antes de emisión no traen `tipo`). */
export interface ResultadosAmbiental extends Comunes {
  tipo?: "ambiental";
  puntos: ResultadoPunto[];
}

export interface ResultadoEmisionEsquema {
  inicio: string | null;
  fin: string | null;
  emision: number | null;
  residual: number | null;
  /** "medido" (fuente apagada) o "L90" (L90 corregido de la propia medición). */
  residual_origen: "medido" | "L90";
  diferencia: number | null;
  estandar: number | null;
  cumple: "Si" | "No" | null;
  del_orden_del_residual: boolean;
  medicion: ResultadoDireccion;
  residual_medicion: ResultadoDireccion | null;
}

export interface ResultadoPuntoEmision {
  no_punto: number;
  nombre: string;
  sector: string;
  incertidumbre: number;
  estandar_diurno: number | null;
  estandar_nocturno: number | null;
  esquemas: Partial<Record<Esquema, ResultadoEmisionEsquema>>;
}

export interface ResultadosEmision extends Comunes {
  tipo: "emision";
  puntos: ResultadoPuntoEmision[];
  barrido: { nombre: string; condicion: string; inicio: string | null; fin: string | null; leq: number | null; seleccionado: boolean }[];
}

export type ResultadosProyecto = ResultadosAmbiental | ResultadosEmision;
