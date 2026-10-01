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

// ------------------------------------------------------------ calidad del aire
/** Estructura devuelta por POST /v1/aire/procesar (engine/service.py aire_a_dict). */
export interface EstadisticaAire {
  n: number;
  promedio: number;
  desviacion: number;
  cv: number;
  mediana: number;
  q1: number;
  q3: number;
  iqr: number;
  lim_inf: number;
  lim_sup: number;
  maximo: number;
  fecha_max: string | null;
  minimo: number;
  fecha_min: string | null;
  atipicos: number;
  bajo_lc: boolean;
}

export interface MuestraAire {
  fecha: string | null;
  inicio: string | null;
  fin: string | null;
  codigo: string;
  minutos: number | null;
  temperatura: number | null;
  presion: number | null;
  caudal: number | null;
  masa: number | null;
  volumen: number | null;
  concentracion: number | null;
  valida: boolean;
  bajo_lc: boolean;
}

export interface ResultadosAire {
  tipo: "aire";
  estaciones: { numero: number; nombre: string; codigo: string }[];
  contaminantes: string[];
  limites: Record<string, Record<string, number>>;
  manuales: {
    contaminante: "PM10" | "PM2.5" | "SO2";
    estacion: number;
    nombre_estacion: string;
    bajo_lc: boolean;
    pct_validas: number | null;
    muestras: MuestraAire[];
    estadistica: EstadisticaAire | null;
  }[];
  automaticos: {
    contaminante: "CO" | "NO2" | "O3";
    estacion: number;
    nombre_estacion: string;
    datos: number;
    dias: { fecha: string; max_horario: number | null; max_8h: number | null; horas: number }[];
    estadistica_1h: EstadisticaAire | null;
    estadistica_8h: EstadisticaAire | null;
  }[];
  cov: {
    compuesto: string;
    estacion: number;
    bajo_lc: boolean;
    muestras: { fecha: string | null; concentracion: number | null; bajo_lc: boolean }[];
    estadistica: EstadisticaAire | null;
  }[];
  /** estación -> contaminante -> ICA diario */
  ica: Record<string, Record<string, { fecha: string; concentracion: number; ica: number | null; categoria: string | null }[]>>;
  advertencias: string[];
}
