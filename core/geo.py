"""Utilidades geograficas minimas: convierte las coordenadas de los puntos de
monitoreo (que pueden venir como longitud/latitud en grados decimales, o como
coordenadas planas en metros -p.ej. Origen Nacional / UTM-) a un plano local
en metros, listo para interpolar y dibujar el mapa de isofonas.

No se usa pyproj/GIS para mantener la aplicacion liviana: para la extension
tipica de un sitio de monitoreo (unos pocos kilometros) una proyeccion
equirectangular centrada en el sitio es suficientemente precisa.
"""
from __future__ import annotations

import math

# Un valor absoluto <= 180 se asume grados decimales (long/lat); por encima
# de eso (p.ej. cientos de miles/millones, tipico de Origen Nacional o UTM)
# se asume que ya viene en metros.
_LIMITE_GRADOS = 180.0

METROS_POR_GRADO_LAT = 110_574.0  # aprox., varia muy poco con la latitud


def _es_coordenada_geografica(x: float, y: float) -> bool:
    return abs(x) <= _LIMITE_GRADOS and abs(y) <= _LIMITE_GRADOS


def coordenadas_a_metros(pares_xy):
    """Convierte una lista de (x, y) a metros locales (origen en el centroide).

    - Si los valores parecen grados decimales (|x|,|y| <= 180), se proyectan
      con una aproximacion equirectangular centrada en el promedio de las
      coordenadas.
    - Si no, se asume que ya son coordenadas planas en metros (Origen
      Nacional, UTM, etc.) y solo se trasladan al centroide.

    Devuelve (lista_de_(x_m, y_m), es_geografica: bool).
    """
    if not pares_xy:
        return [], False

    cx = sum(p[0] for p in pares_xy) / len(pares_xy)
    cy = sum(p[1] for p in pares_xy) / len(pares_xy)
    geografica = _es_coordenada_geografica(cx, cy)

    if not geografica:
        return [(x - cx, y - cy) for x, y in pares_xy], False

    lat0_rad = math.radians(cy)
    metros_por_grado_lon = 111_320.0 * math.cos(lat0_rad)
    resultado = []
    for lon, lat in pares_xy:
        x_m = (lon - cx) * metros_por_grado_lon
        y_m = (lat - cy) * METROS_POR_GRADO_LAT
        resultado.append((x_m, y_m))
    return resultado, True


def parsear_coordenada(valor):
    """Convierte un texto de coordenada (admite coma decimal) a float, o
    None si esta vacio/no es numerico."""
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        return float(texto.replace(",", "."))
    except ValueError:
        return None
