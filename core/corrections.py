"""Motor de calculo: ajustes a los niveles de presion sonora segun la
metodologia de la Resolucion 0627 de 2006 (Colombia), replicando la logica
de la matriz de procesamiento manual (correccion por tono, por impulsividad,
promedio energetico espacial y comparacion contra el estandar admisible).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from .sonometer_reader import BANDAS_TERCIO_OCTAVA

# Orden de las 31 bandas de 20 Hz a 20 kHz usadas en el analisis tonal
# (se excluyen las 5 bandas mas bajas de OBA: 6.3, 8.0, 10.0, 12.5 y 16.0 Hz).
BANDAS_ANALISIS_TONAL = BANDAS_TERCIO_OCTAVA[5:]

# Umbral de diferencia (dB) para asignar Kt=3 / Kt=6, segun grupo de frecuencia.
# (bajo, alto, kt_bajo, kt_alto) evaluado como: dif<bajo -> 0 ; bajo<=dif<alto -> kt_bajo ; dif>=alto -> kt_alto
_UMBRAL_BAJAS = (8, 12)  # 20 Hz - 125 Hz
_UMBRAL_MEDIAS = (5, 8)  # 160 Hz - 400 Hz
_UMBRAL_ALTAS = (3, 5)  # 500 Hz - 20 kHz

_BANDAS_BAJAS = {"20,0", "25,0", "31,5", "40,0", "50,0", "63,0", "80,0", "100", "125"}
_BANDAS_MEDIAS = {"160", "200", "250", "315", "400"}


def _umbral_para_banda(banda: str):
    if banda in _BANDAS_BAJAS:
        return _UMBRAL_BAJAS
    if banda in _BANDAS_MEDIAS:
        return _UMBRAL_MEDIAS
    return _UMBRAL_ALTAS


def promedio_energetico(niveles) -> Optional[float]:
    """Promedio energetico (logaritmico) de una lista de niveles en dB."""
    vals = [v for v in niveles if v is not None]
    if not vals:
        return None
    suma = sum(10 ** (v / 10) for v in vals)
    return 10 * math.log10(suma / len(vals))


def correccion_impulsividad(laeq: Optional[float], laieq: Optional[float]):
    """Calcula Li = |LAIeq - LAeq| y la correccion KI asociada.

    KI = 0 si Li <= 3 ; 3 si 3 < Li < 6 ; 6 si Li >= 6.
    """
    if laeq is None or laieq is None:
        return None, None
    li = abs(laieq - laeq)
    if li >= 6:
        ki = 6
    elif li > 3:
        ki = 3
    else:
        ki = 0
    return li, ki


@dataclass
class ResultadoTonal:
    kt: Optional[float] = None
    detalle: dict = field(default_factory=dict)  # banda -> (leq, ls, diff, kt_banda)


def correccion_tonal(espectro: dict) -> ResultadoTonal:
    """Calcula la correccion por tono KT a partir del espectro en tercios de octava.

    Metodologia (igual a la matriz de procesamiento / ISO 1996-2 Anexo C):
      1. Suavizar el espectro: Ls(i) = (Leq(i-1) + Leq(i+1)) / 2 (bandas 20 Hz-20 kHz).
      2. Diferencia: L(i) = |Leq(i) - Ls(i)|.
      3. Kt(i) segun umbral de frecuencia (ver _umbral_para_banda).
      4. KT = maximo Kt(i) de todas las bandas.
    """
    resultado = ResultadoTonal()
    valores = [espectro.get(b) for b in BANDAS_ANALISIS_TONAL]
    n = len(valores)
    kts = []
    for i, banda in enumerate(BANDAS_ANALISIS_TONAL):
        leq = valores[i]
        anterior = valores[i - 1] if i - 1 >= 0 else None
        siguiente = valores[i + 1] if i + 1 < n else None
        if anterior is None or siguiente is None or leq is None:
            resultado.detalle[banda] = (leq, None, None, None)
            continue
        ls = (anterior + siguiente) / 2
        diff = abs(leq - ls)
        bajo, alto = _umbral_para_banda(banda)
        if diff >= alto:
            kt_banda = 6
        elif diff >= bajo:
            kt_banda = 3
        else:
            kt_banda = 0
        resultado.detalle[banda] = (leq, ls, diff, kt_banda)
        kts.append(kt_banda)

    resultado.kt = max(kts) if kts else None
    return resultado


@dataclass
class ResultadoDireccion:
    direccion: str
    inicio: Optional[object] = None
    fin: Optional[object] = None
    lpico: Optional[float] = None
    lmax: Optional[float] = None
    lmin: Optional[float] = None
    l90: Optional[float] = None
    laeq: Optional[float] = None
    laieq: Optional[float] = None
    li: Optional[float] = None
    ki: Optional[float] = None
    kt: Optional[float] = None
    ks: float = 0.0
    correccion_pantalla: float = 0.0
    correccion: Optional[float] = None
    l90_corregido: Optional[float] = None
    lraeq_corregido: Optional[float] = None
    tipo_ajuste: str = ""
    detalle_tonal: dict = field(default_factory=dict)
    numero_serie: Optional[str] = None
    modelo: Optional[str] = None


def procesar_direccion(direccion: str, datos, ks: float = 0.0, pantalla: float = 0.0) -> ResultadoDireccion:
    """Aplica la metodologia completa a los datos de una direccion/microfono."""
    r = ResultadoDireccion(direccion=direccion)
    r.inicio = datos.inicio
    r.fin = datos.fin
    r.lpico = datos.lpico
    r.lmax = datos.lmax
    r.lmin = datos.lmin
    r.l90 = datos.l90
    r.laeq = datos.laeq
    r.laieq = datos.laieq
    r.numero_serie = getattr(datos, "numero_serie", None)
    r.modelo = getattr(datos, "modelo", None)
    r.ks = ks
    r.correccion_pantalla = pantalla

    r.li, r.ki = correccion_impulsividad(datos.laeq, datos.laieq)

    tonal = correccion_tonal(datos.espectro_laeq)
    r.kt = tonal.kt
    r.detalle_tonal = tonal.detalle

    candidatos = [v for v in (r.ki, r.kt, r.ks, r.correccion_pantalla) if v is not None]
    r.correccion = max(candidatos) if candidatos else None

    if r.l90 is not None and r.correccion is not None:
        r.l90_corregido = r.l90 + r.correccion
    if r.laeq is not None and r.correccion is not None:
        r.lraeq_corregido = r.laeq + r.correccion

    if r.ki is not None and r.kt is not None:
        if r.kt < r.ki:
            r.tipo_ajuste = "Ajuste por Impulso"
        elif r.ki == 0 and r.kt == 0:
            r.tipo_ajuste = "Sin ajuste"
        else:
            r.tipo_ajuste = "Ajuste por tono y contenido de informacion"
    return r


@dataclass
class ResultadoPunto:
    esquema: str  # DH, DNH, NDH, NDNH
    direcciones: dict = field(default_factory=dict)  # direccion -> ResultadoDireccion
    inicio: Optional[object] = None
    fin: Optional[object] = None
    lraeq_resultante: Optional[float] = None
    incertidumbre: float = 0.0


def procesar_punto_esquema(esquema: str, resultados_direccion: dict, incertidumbre: float = 0.0) -> ResultadoPunto:
    """Combina las 5 direcciones de un punto/esquema en el nivel resultante (LRAeq,1h)."""
    rp = ResultadoPunto(esquema=esquema, direcciones=resultados_direccion, incertidumbre=incertidumbre)
    niveles = [rd.lraeq_corregido for rd in resultados_direccion.values()]
    rp.lraeq_resultante = promedio_energetico(niveles)

    inicios = [rd.inicio for rd in resultados_direccion.values() if rd.inicio is not None]
    fines = [rd.fin for rd in resultados_direccion.values() if rd.fin is not None]
    rp.inicio = min(inicios) if inicios else None
    rp.fin = max(fines) if fines else None
    return rp
