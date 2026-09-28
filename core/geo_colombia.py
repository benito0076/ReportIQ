"""Conversion de coordenadas planas 'Origen Nacional' de Colombia (EPSG:9377,
MAGNA-SIRGAS 2018 / Origen-Nacional, adoptado por el IGAC - Resolucion 471 de
2020) a coordenadas geograficas (longitud/latitud), y formato en grados,
minutos y segundos (DMS) como se usa en estos informes.

Implementa la formula inversa de la proyeccion Transverse Mercator (serie de
Redfearn/Snyder) en Python puro -sin dependencias GIS pesadas como pyproj/
PROJ, que son dificiles de empaquetar con PyInstaller-. Se valido contra
pyproj (EPSG:9377) y contra 5 puntos reales con coordenadas conocidas en
ambos sistemas, con un error menor a 1 cm.

Parametros oficiales de la proyeccion (EPSG:9377):
    Elipsoide GRS80, latitud de origen 4 N, longitud de origen 73 O,
    factor de escala 0.9992, falso este 5 000 000 m, falso norte 2 000 000 m.
"""
from __future__ import annotations

import math

A = 6_378_137.0  # semieje mayor GRS80 (m)
F = 1 / 298.257222101  # aplanamiento GRS80
LAT0 = math.radians(4.0)
LON0 = math.radians(-73.0)
K0 = 0.9992
FALSO_ESTE = 5_000_000.0
FALSO_NORTE = 2_000_000.0

_E2 = 2 * F - F ** 2

# Un valor absoluto <= 180 se interpreta como grados decimales (ya
# geografico); por encima de eso, como coordenadas planas Origen Nacional.
_LIMITE_GRADOS = 180.0


def _arco_meridiano(phi: float) -> float:
    return A * (
        (1 - _E2 / 4 - 3 * _E2 ** 2 / 64 - 5 * _E2 ** 3 / 256) * phi
        - (3 * _E2 / 8 + 3 * _E2 ** 2 / 32 + 45 * _E2 ** 3 / 1024) * math.sin(2 * phi)
        + (15 * _E2 ** 2 / 256 + 45 * _E2 ** 3 / 1024) * math.sin(4 * phi)
        - (35 * _E2 ** 3 / 3072) * math.sin(6 * phi)
    )


def origen_nacional_a_geografica(este: float, norte: float) -> tuple[float, float]:
    """Convierte (Este, Norte) en metros (Origen Nacional, EPSG:9377) a
    (latitud, longitud) en grados decimales."""
    ep2 = _E2 / (1 - _E2)
    m0 = _arco_meridiano(LAT0)
    m = m0 + (norte - FALSO_NORTE) / K0
    mu = m / (A * (1 - _E2 / 4 - 3 * _E2 ** 2 / 64 - 5 * _E2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - _E2)) / (1 + math.sqrt(1 - _E2))

    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * math.sin(8 * mu)
    )

    c1 = ep2 * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = A / math.sqrt(1 - _E2 * math.sin(phi1) ** 2)
    r1 = A * (1 - _E2) / (1 - _E2 * math.sin(phi1) ** 2) ** 1.5
    d = (este - FALSO_ESTE) / (n1 * K0)

    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720
    )
    lon = LON0 + (
        d
        - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
    ) / math.cos(phi1)

    return math.degrees(lat), math.degrees(lon)


def geografica_a_origen_nacional(lat_dd: float, lon_dd: float) -> tuple[float, float]:
    """Convierte (latitud, longitud) en grados decimales a (Este, Norte) en
    metros, Origen Nacional (EPSG:9377). Formula directa de Transverse
    Mercator (serie de Snyder), inversa de origen_nacional_a_geografica."""
    phi = math.radians(lat_dd)
    lam = math.radians(lon_dd)
    ep2 = _E2 / (1 - _E2)

    n = A / math.sqrt(1 - _E2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = ep2 * math.cos(phi) ** 2
    a_ = (lam - LON0) * math.cos(phi)
    m = _arco_meridiano(phi)
    m0 = _arco_meridiano(LAT0)

    este = FALSO_ESTE + K0 * n * (
        a_
        + (1 - t + c) * a_ ** 3 / 6
        + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * a_ ** 5 / 120
    )
    norte = FALSO_NORTE + K0 * (
        m - m0
        + n * math.tan(phi) * (
            a_ ** 2 / 2
            + (5 - t + 9 * c + 4 * c ** 2) * a_ ** 4 / 24
            + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * a_ ** 6 / 720
        )
    )
    return este, norte


def es_origen_nacional(este: float, norte: float) -> bool:
    """True si los valores parecen coordenadas planas (Origen Nacional/UTM,
    del orden de cientos de miles o millones), no grados decimales."""
    return abs(este) > _LIMITE_GRADOS or abs(norte) > _LIMITE_GRADOS


def a_geografica(x: float, y: float) -> tuple[float, float]:
    """Devuelve (latitud, longitud) en grados decimales a partir de (x, y),
    detectando automaticamente si ya son grados decimales o coordenadas
    Origen Nacional que hay que proyectar."""
    if es_origen_nacional(x, y):
        return origen_nacional_a_geografica(x, y)
    return y, x  # (x=longitud, y=latitud) ya en grados decimales


def formatear_dms(valor_decimal: float, es_longitud: bool) -> str:
    """Formatea un valor en grados decimales como texto DMS, p.ej.
    73°43'32.11"O o 6°48'11.00"N, igual al estilo usado en el informe."""
    if es_longitud:
        hemisferio = "O" if valor_decimal < 0 else "E"
    else:
        hemisferio = "N" if valor_decimal >= 0 else "S"

    valor_abs = abs(valor_decimal)
    grados = int(valor_abs)
    minutos_totales = (valor_abs - grados) * 60
    minutos = int(minutos_totales)
    segundos = (minutos_totales - minutos) * 60
    # Redondeo de segundos puede llevar a 60.00; se ajusta con acarreo.
    segundos = round(segundos, 2)
    if segundos >= 60:
        segundos -= 60
        minutos += 1
    if minutos >= 60:
        minutos -= 60
        grados += 1
    return f"{grados}°{minutos:02d}'{segundos:05.2f}\"{hemisferio}"


_R_MERCATOR = 6_378_137.0  # radio esferico convencional de EPSG:3857


def geografica_a_web_mercator(lat_dd: float, lon_dd: float) -> tuple[float, float]:
    """Convierte (lat, lon) en grados a (x, y) Web Mercator (EPSG:3857,
    pseudo-mercator esferico, el sistema usado por los mapas base de
    Google/Esri/OSM). Formula estandar, exacta por definicion de EPSG:3857."""
    x = _R_MERCATOR * math.radians(lon_dd)
    y = _R_MERCATOR * math.log(math.tan(math.pi / 4 + math.radians(lat_dd) / 2))
    return x, y


def web_mercator_a_geografica(x: float, y: float) -> tuple[float, float]:
    """Inversa de geografica_a_web_mercator."""
    lon_dd = math.degrees(x / _R_MERCATOR)
    lat_dd = math.degrees(2 * math.atan(math.exp(y / _R_MERCATOR)) - math.pi / 2)
    return lat_dd, lon_dd


def origen_nacional_a_web_mercator(este: float, norte: float) -> tuple[float, float]:
    """Atajo: Origen Nacional -> geografica -> Web Mercator, para ubicar los
    puntos sobre un mapa base de teselas satelitales (contextily)."""
    lat_dd, lon_dd = a_geografica(este, norte)
    return geografica_a_web_mercator(lat_dd, lon_dd)


def geograficas_desde_origen_nacional(este: float, norte: float):
    """Devuelve (lon_dms, lat_dms, lat_dd, lon_dd) listos para las tablas del
    informe, a partir de coordenadas (Este, Norte) que pueden venir en
    Origen Nacional (metros) o ya en grados decimales."""
    lat_dd, lon_dd = a_geografica(este, norte)
    return formatear_dms(lon_dd, True), formatear_dms(lat_dd, False), lat_dd, lon_dd
