"""Orquesta el procesamiento completo de un proyecto: lee memorias, aplica
correcciones, calcula el nivel resultante por punto/esquema y lo compara
contra el estandar de la Res. 0627 segun el sector asignado a cada punto.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from . import norms
from .corrections import ResultadoPunto, procesar_direccion, procesar_punto_esquema
from .models import DIRECCIONES, ESQUEMAS, Proyecto, Punto
from .sonometer_reader import ErrorLecturaMemoria, leer_memoria


@dataclass
class AdvertenciaProceso:
    punto: str
    esquema: str
    direccion: str
    mensaje: str


@dataclass
class ResultadoComparacion:
    punto: Punto
    lraeq_dh: Optional[float] = None
    lraeq_dnh: Optional[float] = None
    lraeq_ndh: Optional[float] = None
    lraeq_ndnh: Optional[float] = None
    estandar_diurno: Optional[float] = None
    estandar_nocturno: Optional[float] = None
    cumple_dh: Optional[str] = None
    cumple_dnh: Optional[str] = None
    cumple_ndh: Optional[str] = None
    cumple_ndnh: Optional[str] = None


@dataclass
class ResultadosProyecto:
    proyecto: Proyecto
    por_punto: dict = field(default_factory=dict)  # no_punto -> {esquema: ResultadoPunto}
    comparacion: dict = field(default_factory=dict)  # no_punto -> ResultadoComparacion
    advertencias: list = field(default_factory=list)
    equipos_detectados: dict = field(default_factory=dict)  # serial -> modelo (segun las memorias leidas)


def procesar_proyecto(proyecto: Proyecto) -> ResultadosProyecto:
    resultados = ResultadosProyecto(proyecto=proyecto)

    for punto in proyecto.puntos:
        resultados.por_punto[punto.no_punto] = {}
        for esquema in punto.esquemas_activos():
            resultados_direccion = {}
            for direccion in DIRECCIONES:
                archivo = punto.archivos[esquema][direccion]
                if not archivo.ruta:
                    continue
                extra = punto.correcciones_manuales.get((esquema, direccion), {})
                ks = extra.get("KS", 0.0)
                pantalla = extra.get("pantalla", 0.0)
                try:
                    datos = leer_memoria(archivo.ruta)
                except ErrorLecturaMemoria as exc:
                    resultados.advertencias.append(
                        AdvertenciaProceso(punto.nombre, esquema, direccion, str(exc))
                    )
                    continue
                if datos.laeq is None:
                    resultados.advertencias.append(AdvertenciaProceso(
                        punto.nombre, esquema, direccion,
                        "No se encontro el LAeq en la hoja 'Resumen' de la memoria (formato de "
                        "exportacion no reconocido); esta direccion no tendra nivel corregido. "
                        "Contenido de la hoja: " + " / ".join(datos.muestra_resumen[:25]),
                    ))
                rd = procesar_direccion(direccion, datos, ks=ks, pantalla=pantalla)
                resultados_direccion[direccion] = rd
                if rd.numero_serie:
                    resultados.equipos_detectados.setdefault(rd.numero_serie, rd.modelo)

            if not resultados_direccion:
                continue

            faltantes = [d for d in DIRECCIONES if d not in resultados_direccion]
            if faltantes:
                resultados.advertencias.append(
                    AdvertenciaProceso(
                        punto.nombre, esquema, ",".join(faltantes),
                        f"No se asigno archivo de memoria para esta(s) direccion(es) en {esquema}."
                    )
                )

            rp = procesar_punto_esquema(esquema, resultados_direccion, incertidumbre=punto.incertidumbre)
            resultados.por_punto[punto.no_punto][esquema] = rp

        resultados.comparacion[punto.no_punto] = _comparar_norma(punto, resultados.por_punto[punto.no_punto])

    return resultados


def _comparar_norma(punto: Punto, resultados_esquema: dict) -> ResultadoComparacion:
    rc = ResultadoComparacion(punto=punto)
    if "DH" in resultados_esquema:
        rc.lraeq_dh = resultados_esquema["DH"].lraeq_resultante
    if "DNH" in resultados_esquema:
        rc.lraeq_dnh = resultados_esquema["DNH"].lraeq_resultante
    if "NDH" in resultados_esquema:
        rc.lraeq_ndh = resultados_esquema["NDH"].lraeq_resultante
    if "NDNH" in resultados_esquema:
        rc.lraeq_ndnh = resultados_esquema["NDNH"].lraeq_resultante

    if punto.sector:
        rc.estandar_diurno = norms.estandar_diurno(punto.sector)
        rc.estandar_nocturno = norms.estandar_nocturno(punto.sector)

    rc.cumple_dh = norms.cumple(rc.lraeq_dh, rc.estandar_diurno)
    rc.cumple_dnh = norms.cumple(rc.lraeq_dnh, rc.estandar_diurno)
    rc.cumple_ndh = norms.cumple(rc.lraeq_ndh, rc.estandar_nocturno)
    rc.cumple_ndnh = norms.cumple(rc.lraeq_ndnh, rc.estandar_nocturno)
    return rc
