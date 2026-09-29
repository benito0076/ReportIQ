"""Emision de ruido (Res. 0627 de 2006, Anexo 3, Capitulo I y Articulo 9),
replicando la plantilla FP-007 "Procesamiento datos emision de ruido":

- Una medicion de una hora por punto y jornada, con el microfono hacia la
  fuente. Se corrige igual que en ambiental: K = max(KI, KT, KR, KS,
  pantalla), LRAeq = LAeq + K y L90 corregido = L90 + K.
- Residual: si se midio con la fuente apagada, es el LRAeq corregido de esa
  memoria; si no, el L90 corregido de la propia medicion.
- Emision:  si residual > LRAeq            -> LRAeq
            si |LRAeq - residual| <= 3 dB  -> residual (del orden del residual)
            si no  -> 10*log10(10^(LRAeq/10) - 10^(residual/10))
- Cumple: "Si" cuando estandar >= emision (hoja DH, columna Y).
- Barrido perimetral: memorias de 2 minutos, ordenadas de mayor a menor Leq.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from .corrections import ResultadoDireccion, procesar_direccion
from .models import ESQUEMAS, Proyecto
from .sonometer_reader import ErrorLecturaMemoria, leer_memoria

# Ranuras de memoria por punto y jornada en un proyecto de emision.
EMISION = "Emision"
RESIDUAL = "Residual"
RANURAS_EMISION = [EMISION, RESIDUAL]

# Estandares maximos permisibles de EMISION de ruido, Res. 0627 Art. 9
# (hoja "Base normativa" de FP-007). Mismas etiquetas de sector que ambiental.
ESTANDARES_EMISION = {
    "A": [(55, 50)],
    "B": [(65, 55), (65, 55), (65, 55)],
    "C": [(75, 75), (70, 60), (65, 55), (65, 55), (80, 75)],
    "D": [(55, 50), (55, 50), (55, 50)],
}


def estandares_emision(etiqueta: str):
    """(dia, noche) de emision para una etiqueta de sector de core.norms."""
    from .norms import TABLA_RES_0627

    orden = {}
    for s in TABLA_RES_0627:
        i = orden.get(s.sector, 0)
        orden[s.sector] = i + 1
        if s.etiqueta == etiqueta:
            valores = ESTANDARES_EMISION.get(s.sector, [])
            return valores[i] if i < len(valores) else (None, None)
    return None, None


def estandar_punto(etiqueta: str, esquema: str):
    """Estandar de emision del sector del punto para la jornada del esquema."""
    dia, noche = estandares_emision(etiqueta) if etiqueta else (None, None)
    return dia if esquema in ("DH", "DNH") else noche


def cumple_emision(nivel, estandar) -> Optional[str]:
    if nivel is None or estandar is None:
        return None
    return "Si" if estandar >= nivel else "No"


def nivel_emision(lraeq: Optional[float], residual: Optional[float]) -> Optional[float]:
    if lraeq is None or residual is None:
        return None
    if residual > lraeq:
        return lraeq
    if abs(lraeq - residual) <= 3:
        return residual
    return 10 * math.log10(10 ** (lraeq / 10) - 10 ** (residual / 10))


@dataclass
class ResultadoEmision:
    esquema: str
    medicion: ResultadoDireccion
    residual_medido: Optional[ResultadoDireccion] = None
    residual: Optional[float] = None  # LRAeq residual usado en el calculo
    emision: Optional[float] = None
    diferencia: Optional[float] = None  # LRAeq corregido - residual
    estandar: Optional[float] = None
    cumple: Optional[str] = None
    incertidumbre: float = 0.0

    @property
    def residual_es_l90(self) -> bool:
        return self.residual_medido is None

    @property
    def del_orden_del_residual(self) -> bool:
        """Literal F: diferencia <= 3 dB(A), el nivel de emision es del orden del residual."""
        return self.diferencia is not None and abs(self.diferencia) <= 3

    @property
    def direcciones(self) -> dict:
        """Compatibilidad con ambiental (p. ej. fechas de medicion para la meteorologia)."""
        return {EMISION: self.medicion}

    @property
    def inicio(self):
        return self.medicion.inicio

    @property
    def fin(self):
        return self.medicion.fin


@dataclass
class ItemBarrido:
    nombre: str
    condicion: str = "Encendido"
    ruta: str = ""
    seleccionado: bool = False


@dataclass
class ResultadoBarrido:
    nombre: str
    condicion: str
    inicio: object
    fin: object
    leq: Optional[float]
    seleccionado: bool


@dataclass
class Advertencia:
    punto: str
    esquema: str
    direccion: str
    mensaje: str


@dataclass
class ResultadosEmision:
    proyecto: Proyecto
    por_punto: dict = field(default_factory=dict)  # no_punto -> {esquema: ResultadoEmision}
    barrido: list = field(default_factory=list)  # [ResultadoBarrido], de mayor a menor Leq
    advertencias: list = field(default_factory=list)
    equipos_detectados: dict = field(default_factory=dict)

    def resultado(self, punto, esquema) -> Optional[ResultadoEmision]:
        return self.por_punto.get(punto.no_punto, {}).get(esquema)


def _leer(ruta, punto, esquema, ranura, resultados):
    try:
        datos = leer_memoria(ruta)
    except ErrorLecturaMemoria as exc:
        resultados.advertencias.append(Advertencia(punto, esquema, ranura, str(exc)))
        return None
    if datos.laeq is None:
        resultados.advertencias.append(Advertencia(
            punto, esquema, ranura, "No se encontro el LAeq en la hoja 'Resumen' de la memoria."))
    return datos


def procesar_emision(proyecto: Proyecto) -> ResultadosEmision:
    resultados = ResultadosEmision(proyecto=proyecto)
    for punto in proyecto.puntos:
        por_esquema = {}
        for esquema in ESQUEMAS:
            ranuras = punto.archivos.get(esquema, {})
            archivo = ranuras.get(EMISION)
            if archivo is None or not archivo.ruta:
                residual = ranuras.get(RESIDUAL)
                if residual is not None and residual.ruta:
                    resultados.advertencias.append(Advertencia(
                        punto.nombre, esquema, RESIDUAL,
                        "Hay memoria de ruido residual pero falta la medicion con la fuente en operacion."))
                continue
            extra = punto.correcciones_manuales.get((esquema, EMISION), {})
            datos = _leer(archivo.ruta, punto.nombre, esquema, EMISION, resultados)
            if datos is None:
                continue
            medicion = procesar_direccion(EMISION, datos, ks=extra.get("KS", 0.0),
                                          pantalla=extra.get("pantalla", 0.0))
            if medicion.numero_serie:
                resultados.equipos_detectados.setdefault(medicion.numero_serie, medicion.modelo)
            r = ResultadoEmision(esquema=esquema, medicion=medicion, incertidumbre=punto.incertidumbre)

            archivo_residual = ranuras.get(RESIDUAL)
            if archivo_residual is not None and archivo_residual.ruta:
                datos_r = _leer(archivo_residual.ruta, punto.nombre, esquema, RESIDUAL, resultados)
                if datos_r is not None:
                    extra_r = punto.correcciones_manuales.get((esquema, RESIDUAL), {})
                    r.residual_medido = procesar_direccion(RESIDUAL, datos_r, ks=extra_r.get("KS", 0.0),
                                                           pantalla=extra_r.get("pantalla", 0.0))
                    r.residual = r.residual_medido.lraeq_corregido
                    if r.residual_medido.numero_serie:
                        resultados.equipos_detectados.setdefault(r.residual_medido.numero_serie,
                                                                 r.residual_medido.modelo)
            if r.residual_medido is None:
                r.residual = medicion.l90_corregido

            r.emision = nivel_emision(medicion.lraeq_corregido, r.residual)
            if medicion.lraeq_corregido is not None and r.residual is not None:
                r.diferencia = medicion.lraeq_corregido - r.residual
            r.estandar = estandar_punto(punto.sector, esquema)
            r.cumple = cumple_emision(r.emision, r.estandar)
            por_esquema[esquema] = r
        resultados.por_punto[punto.no_punto] = por_esquema

    for item in proyecto.barrido:
        if not item.ruta:
            continue
        datos = _leer(item.ruta, item.nombre, "Barrido", "", resultados)
        if datos is None:
            continue
        resultados.barrido.append(ResultadoBarrido(item.nombre, item.condicion, datos.inicio, datos.fin,
                                                   datos.laeq, item.seleccionado))
        if getattr(datos, "numero_serie", None):
            resultados.equipos_detectados.setdefault(datos.numero_serie, getattr(datos, "modelo", None))
    resultados.barrido.sort(key=lambda b: -(b.leq if b.leq is not None else -1e9))
    return resultados
