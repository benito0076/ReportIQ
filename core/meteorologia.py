"""Datos meteorologicos del informe (capitulo METEOROLOGIA).

Lee el archivo exportado de la estacion meteorologica (p.ej. Davis
WeatherLink: una fila por intervalo con fecha/hora, presion, temperatura,
humedad, viento y lluvia), toma SOLO los registros de los dias en que se
hicieron las mediciones de ruido y calcula todo lo necesario para esa parte
del informe: tabla de promedios diarios, textos de cada variable, rosa de
vientos (16 direcciones x clases de velocidad, como WRPLOT) y graficas.

Las columnas se identifican por el nombre del encabezado (no por su
posicion) y se descartan las filas con valores fisicamente imposibles
(p.ej. un bloque pegado con otro formato de exportacion), informandolo en
las advertencias."""
from __future__ import annotations

import math
import os
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

import openpyxl

# ----------------------------------------------------------------- lectura
DIRECCIONES_16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
NOMBRES_DIRECCION = {
    "N": "Norte", "NNE": "NorteNorEste", "NE": "NorEste", "ENE": "EsteNorEste",
    "E": "Este", "ESE": "EsteSurEste", "SE": "SurEste", "SSE": "SurSurEste",
    "S": "Sur", "SSW": "SurSurOeste", "SW": "SurOeste", "WSW": "OesteSurOeste",
    "W": "Oeste", "WNW": "OesteNorOeste", "NW": "NorOeste", "NNW": "NorteNorOeste",
}
# Clases de velocidad del viento (m/s), iguales a las de WRPLOT. Por debajo
# del primer limite el registro cuenta como calma.
LIMITE_CALMA = 0.30
CLASES_VIENTO = [(0.30, 1.60), (1.60, 3.40), (3.40, 5.50), (5.50, 8.00), (8.00, None)]

# Rangos fisicamente posibles: una fila fuera de rango se descarta.
RANGOS = {
    "temperatura": (-20.0, 55.0),
    "humedad": (0.0, 100.0),
    "presion": (400.0, 800.0),  # mmHg
    "viento": (0.0, 60.0),  # m/s
    "lluvia": (0.0, 500.0),  # mm por intervalo
}

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


class ErrorMeteorologia(Exception):
    pass


@dataclass
class Registro:
    fecha: datetime
    temperatura: Optional[float] = None
    humedad: Optional[float] = None
    presion: Optional[float] = None  # mmHg
    viento: Optional[float] = None  # m/s
    direccion: Optional[str] = None  # una de DIRECCIONES_16, o None (calma / sin dato)
    lluvia: Optional[float] = None  # mm en el intervalo


def _reparar_mojibake(texto: str) -> str:
    """Encabezados UTF-8 leidos como Latin-1 por la estacion ('PresiÃ³n' -> 'Presión')."""
    try:
        return texto.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return texto


def _norm(texto) -> str:
    t = _reparar_mojibake(str(texto or ""))
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t.strip().lower())


def _es_extremo(h: str) -> bool:
    return bool(re.search(r"\b(high|low|hi|lo|max|min|maxima|minima|maximo|minimo|alta|baja)\b", h))


def _columnas(encabezado) -> dict:
    """Mapea variable -> (indice, factor de conversion) segun el encabezado."""
    cols = {}
    for i, celda in enumerate(encabezado):
        h = _norm(celda)
        if not h or h.startswith(("indoor", "interior")):
            continue
        # Estaciones tipo Ecowitt/EasyWeather: "Outdoor Temperature(℃)", "Outdoor Humidity(%)".
        h = re.sub(r"^(outdoor|exterior)\s*", "", h)
        if "fecha" not in cols and (h.startswith("date") or h.startswith("fecha") or h in ("time", "tiempo")
                                     or h.startswith("time(") or h.startswith("time (")):
            cols["fecha"] = (i, 1.0)
        elif "presion" not in cols and (h.startswith("barometer") or h.startswith("presion") or h.startswith("bar ")
                                         or h.startswith(("abs pressure", "rel pressure", "pressure"))) \
                and not _es_extremo(h):
            factor = 1.0
            if "hpa" in h or "mb" in h:
                factor = 0.750062
            elif "inhg" in h or "in hg" in h:
                factor = 25.4
            cols["presion"] = (i, factor)
        elif "temperatura" not in cols and (h.startswith("temp") or h.startswith("temperatura")) \
                and not _es_extremo(h) and "index" not in h:
            factor = "F" if ("°f" in str(celda).lower() or re.search(r"\bf\)?$", h)) else 1.0
            cols["temperatura"] = (i, factor)
        elif "humedad" not in cols and (h.startswith("hum") or h.startswith("humedad")) and not _es_extremo(h):
            cols["humedad"] = (i, 1.0)
        elif "viento" not in cols and (h.startswith("wind speed") or h.startswith("velocidad") or h == "wind"
                                        or h.startswith("wind(") or h.startswith("wind (") or h.startswith("viento")) \
                and not _es_extremo(h):
            factor = 1 / 3.6 if "km/h" in h else (0.44704 if "mph" in h else 1.0)
            cols["viento"] = (i, factor)
        elif "direccion" not in cols and (h.startswith("wind direction") or h.startswith("wind dir")
                                           or h.startswith("direccion")) and not _es_extremo(h):
            cols["direccion"] = (i, 1.0)
        elif "lluvia" not in cols and (h.startswith("rain - ") or h == "rain" or h.startswith("rain (")
                                        or h.startswith("precipitacion") or h.startswith("lluvia")) \
                and "rate" not in h and "intensidad" not in h:
            factor = 25.4 if re.search(r"\bin\b", h) else 1.0
            cols["lluvia"] = (i, factor)
        elif "lluvia" not in cols and h.startswith(("hourly rain", "lluvia horaria")):
            # Estaciones tipo Ecowitt/EasyWeather: se suma igual que en los informes (valor por registro).
            cols["lluvia"] = (i, 1.0)
    return cols


def _numero(valor) -> Optional[float]:
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    t = str(valor).strip().replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def _direccion(valor) -> Optional[str]:
    """Direccion de 16 puntos: acepta abreviaturas en ingles o espanol
    (O = Oeste) o grados (0-360)."""
    if valor is None:
        return None
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        if not 0 <= valor <= 360:
            return None
        return DIRECCIONES_16[int((valor % 360) / 22.5 + 0.5) % 16]
    t = str(valor).strip().upper().replace("O", "W")
    return t if t in DIRECCIONES_16 else None


def _fecha(valor) -> Optional[datetime]:
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, date):
        return datetime(valor.year, valor.month, valor.day)
    if isinstance(valor, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S",
                    "%d/%m/%y %H:%M", "%m/%d/%y %I:%M %p", "%m/%d/%Y %H:%M"):
            try:
                return datetime.strptime(valor.strip(), fmt)
            except ValueError:
                continue
    return None


def _en_rango(var, valor) -> bool:
    lo, hi = RANGOS[var]
    return valor is None or lo <= valor <= hi


def leer_datos_meteorologicos(ruta: str) -> tuple[list, list]:
    """Lee el archivo de la estacion. Devuelve (registros, advertencias)."""
    try:
        wb = openpyxl.load_workbook(ruta, data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001
        raise ErrorMeteorologia(f"No se pudo abrir el archivo de datos meteorologicos: {exc}") from exc

    mejor = None
    for ws in wb.worksheets:
        filas = ws.iter_rows(values_only=True)
        for n, fila in enumerate(filas):
            if n > 10:
                break
            cols = _columnas(fila or ())
            if "fecha" in cols and len(cols) >= 3:
                mejor = (ws, n, cols)
                break
        if mejor:
            break
    if not mejor:
        wb.close()
        raise ErrorMeteorologia(
            "No se reconocieron las columnas del archivo de datos meteorologicos. Se espera una fila de "
            "encabezado con la fecha/hora y al menos dos variables (p.ej. 'Date & Time', 'Temp - °C', "
            "'Hum - %', 'Barometer - mm Hg', 'Wind Speed - m/s', 'Wind Direction', 'Rain - mm')."
        )

    ws, fila_encabezado, cols = mejor
    registros, descartadas = [], []
    for n, fila in enumerate(ws.iter_rows(values_only=True)):
        if n <= fila_encabezado or not fila:
            continue
        fecha = _fecha(fila[cols["fecha"][0]]) if cols["fecha"][0] < len(fila) else None
        if fecha is None:
            continue
        r = Registro(fecha=fecha)
        valido = True
        for var in ("temperatura", "humedad", "presion", "viento", "lluvia"):
            if var not in cols:
                continue
            idx, factor = cols[var]
            v = _numero(fila[idx]) if idx < len(fila) else None
            if v is not None:
                v = (v - 32) * 5 / 9 if factor == "F" else v * factor
            if not _en_rango(var, v):
                valido = False
            setattr(r, var, v)
        if "direccion" in cols and cols["direccion"][0] < len(fila):
            crudo = fila[cols["direccion"][0]]
            r.direccion = _direccion(crudo)
            # Un numero fuera de 0-360 donde va la direccion delata una fila desplazada.
            if isinstance(crudo, (int, float)) and r.direccion is None:
                valido = False
        if valido:
            registros.append(r)
        else:
            descartadas.append(fecha)
    wb.close()

    advertencias = []
    if descartadas:
        advertencias.append(
            f"Datos meteorologicos: se descartaron {len(descartadas)} fila(s) con valores fuera de rango "
            f"(entre {_fmt_fecha_hora(min(descartadas))} y {_fmt_fecha_hora(max(descartadas))}); "
            "posiblemente datos pegados con otro formato de exportacion. Revise el archivo."
        )
    faltan = [v for v in ("temperatura", "humedad", "presion", "viento", "direccion", "lluvia") if v not in cols]
    if faltan:
        advertencias.append("Datos meteorologicos: no se encontraron las columnas de " + ", ".join(faltan) + ".")
    return registros, advertencias


# ----------------------------------------------------------------- analisis
@dataclass
class ResumenDiario:
    dia: date
    temperatura: Optional[float]
    humedad: Optional[float]
    presion: Optional[float]
    lluvia: Optional[float]  # acumulada del dia
    viento: Optional[float]


@dataclass
class AnalisisMeteo:
    dias: list  # [ResumenDiario]
    registros: list  # registros de los dias de medicion
    frecuencias: dict  # direccion -> [pct por clase]
    calmas_pct: float
    clases_pct: list  # pct por clase (sin calmas)
    vector_resultante: Optional[tuple]  # (grados, pct)
    lluvia_en_mediciones: float
    viento_max_en_mediciones: Optional[float]
    textos: dict = field(default_factory=dict)
    advertencias: list = field(default_factory=list)


def _media(valores):
    v = [x for x in valores if x is not None]
    return sum(v) / len(v) if v else None


def fmt(v, dec=2) -> str:
    return "—" if v is None else f"{v:.{dec}f}".replace(".", ",")


def _fmt_dia(d: date) -> str:
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def _fmt_fecha_hora(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y %H:%M")


def fechas_de_medicion(resultados_proyecto) -> tuple[set, list]:
    """Dias de medicion e intervalos [inicio, fin] de cada medicion, segun las
    horas leidas en las memorias del sonometro."""
    dias, intervalos = set(), []
    for por_esquema in resultados_proyecto.por_punto.values():
        for rp in por_esquema.values():
            for rd in rp.direcciones.values():
                ini, fin = _fecha(rd.inicio), _fecha(rd.fin)
                if ini:
                    dias.add(ini.date())
                if fin:
                    dias.add(fin.date())
                if ini and fin:
                    intervalos.append((ini, fin))
    return dias, intervalos


def _clase(v: float) -> Optional[int]:
    for i, (lo, hi) in enumerate(CLASES_VIENTO):
        if v >= lo and (hi is None or v < hi):
            return i
    return None


def analizar(registros: list, dias: set, intervalos: list) -> Optional[AnalisisMeteo]:
    """Filtra los registros a los dias de medicion y calcula los resumenes.
    Devuelve None si no hay datos para esos dias."""
    sel = sorted((r for r in registros if r.fecha.date() in dias), key=lambda r: r.fecha)
    if not sel:
        return None

    por_dia = {}
    for r in sel:
        por_dia.setdefault(r.fecha.date(), []).append(r)
    resumen = []
    for d in sorted(por_dia):
        rs = por_dia[d]
        lluvias = [r.lluvia for r in rs if r.lluvia is not None]
        resumen.append(ResumenDiario(
            dia=d,
            temperatura=_media(r.temperatura for r in rs),
            humedad=_media(r.humedad for r in rs),
            presion=_media(r.presion for r in rs),
            lluvia=sum(lluvias) if lluvias else None,
            viento=_media(r.viento for r in rs),
        ))

    # Rosa de vientos: porcentaje sobre el total de registros con velocidad.
    con_viento = [r for r in sel if r.viento is not None]
    total = len(con_viento)
    conteo = {d: [0] * len(CLASES_VIENTO) for d in DIRECCIONES_16}
    calmas = 0
    u = v = 0.0
    for r in con_viento:
        if r.viento < LIMITE_CALMA or r.direccion is None:
            calmas += 1
            continue
        conteo[r.direccion][_clase(r.viento)] += 1
        ang = math.radians(DIRECCIONES_16.index(r.direccion) * 22.5)
        u += math.sin(ang)
        v += math.cos(ang)
    frecuencias = {d: [100 * c / total for c in cs] for d, cs in conteo.items()} if total else {}
    clases_pct = [sum(frecuencias[d][i] for d in DIRECCIONES_16) for i in range(len(CLASES_VIENTO))] if total else []
    calmas_pct = 100 * calmas / total if total else 0.0
    vector = None
    if total and (u or v):
        grados = (math.degrees(math.atan2(u, v)) + 360) % 360
        vector = (grados, 100 * math.hypot(u, v) / total)

    # Condiciones durante los intervalos de medicion (Res. 0627: sin lluvia y viento < 3 m/s).
    def en_medicion(r):
        return any(ini - timedelta(minutes=59) <= r.fecha <= fin + timedelta(minutes=59) for ini, fin in intervalos)
    durante = [r for r in sel if en_medicion(r)]
    lluvia_med = sum(r.lluvia for r in durante if r.lluvia)
    vientos_med = [r.viento for r in durante if r.viento is not None]

    analisis = AnalisisMeteo(
        dias=resumen, registros=sel, frecuencias=frecuencias, calmas_pct=calmas_pct,
        clases_pct=clases_pct, vector_resultante=vector, lluvia_en_mediciones=lluvia_med,
        viento_max_en_mediciones=max(vientos_med) if vientos_med else None,
    )
    faltantes = sorted(dias - set(por_dia))
    if faltantes:
        analisis.advertencias.append(
            "Datos meteorologicos: no hay registros para " + ", ".join(_fmt_dia(d) for d in faltantes)
            + " (dia(s) de medicion)."
        )
    if analisis.viento_max_en_mediciones is not None and analisis.viento_max_en_mediciones >= 3:
        analisis.advertencias.append(
            f"Datos meteorologicos: durante las mediciones se registro viento de hasta "
            f"{fmt(analisis.viento_max_en_mediciones)} m/s (la Res. 0627 exige medir con viento menor a 3 m/s)."
        )
    if lluvia_med > 0:
        analisis.advertencias.append(
            f"Datos meteorologicos: se registraron {fmt(lluvia_med)} mm de lluvia durante los intervalos de medicion."
        )
    analisis.textos = _textos(analisis)
    return analisis


# ------------------------------------------------------------------ textos
def _texto_variable(dias, attr, nombre, unidad, grafica, articulo="La", decimales=2, unidad_variacion=None):
    vals = [(d.dia, getattr(d, attr)) for d in dias if getattr(d, attr) is not None]
    if not vals:
        return f"No se dispone de registros de {nombre} para los días de monitoreo."
    prom = _media(v for _, v in vals)
    if len(vals) == 1:
        return (f"{articulo} {nombre} promedio registrada el {_fmt_dia(vals[0][0])}, único día de monitoreo, "
                f"fue de {fmt(prom, decimales)} {unidad}. (ver {grafica}).")
    d_max, v_max = max(vals, key=lambda x: x[1])
    d_min, v_min = min(vals, key=lambda x: x[1])
    return (f"Durante el periodo de monitoreo, {articulo.lower()} {nombre} promedio fue de {fmt(prom, decimales)} {unidad}, "
            f"con valores diarios entre {fmt(v_min, decimales)} {unidad} y {fmt(v_max, decimales)} {unidad}. "
            f"El valor más alto se registró el {_fmt_dia(d_max)}, mientras que el más bajo correspondió al "
            f"{_fmt_dia(d_min)}, con una variación de {fmt(v_max - v_min, decimales)} {unidad_variacion or unidad}")


def _textos(a: AnalisisMeteo) -> dict:
    dias = a.dias
    n = len(dias)
    t = {}

    temp = _texto_variable(dias, "temperatura", "temperatura", "°C", "Gráfica 1")
    if n > 1:
        prom = _media(d.temperatura for d in dias)
        cond = "cálidas" if prom and prom >= 24 else ("templadas" if prom and prom >= 15 else "frías")
        temp += f", evidenciando condiciones {cond} durante las {n} jornadas evaluadas (ver Gráfica 1)."
    t["temperatura"] = temp

    hum = _texto_variable(dias, "humedad", "humedad relativa", "%", "Gráfica 2",
                          unidad_variacion="puntos porcentuales")
    if n > 1:
        vals = [d for d in dias if d.humedad is not None and d.temperatura is not None]
        if vals and min(vals, key=lambda d: d.humedad).dia == max(vals, key=lambda d: d.temperatura).dia:
            hum += ". El menor porcentaje de humedad coincidió con la jornada de mayor temperatura (ver Gráfica 2)."
        else:
            hum += " (ver Gráfica 2)."
    t["humedad"] = hum

    pres = _texto_variable(dias, "presion", "presión atmosférica", "mmHg", "Gráfica 3")
    if n > 1:
        vals = [d.presion for d in dias if d.presion is not None]
        estable = vals and (max(vals) - min(vals)) < 3
        pres += (", mostrando un comportamiento relativamente estable (ver Gráfica 3)." if estable
                 else ", con variaciones apreciables entre jornadas (ver Gráfica 3).")
    t["presion"] = pres

    lluvias = [(d.dia, d.lluvia) for d in dias if d.lluvia is not None]
    total_lluvia = sum(v for _, v in lluvias)
    if not lluvias:
        t["precipitacion"] = "No se dispone de registros de precipitación para los días de monitoreo."
    elif total_lluvia == 0:
        t["precipitacion"] = (
            "Cabe aclarar que, durante el desarrollo de cada una de las mediciones, se dio cumplimiento a las "
            "condiciones establecidas en la Resolución aplicable, teniendo en cuenta que no se reportó presencia "
            "de lluvias durante la ejecución de los monitoreos. De igual manera, los registros meteorológicos "
            "asociados a las jornadas evaluadas no evidenciaron eventos de precipitación.")
    else:
        con_lluvia = [f"{_fmt_dia(d)} ({fmt(v)} mm)" for d, v in lluvias if v > 0]
        durante = ("no se registró precipitación durante los intervalos en que se realizaron las mediciones, dando "
                   "cumplimiento a las condiciones establecidas en la Resolución aplicable" if a.lluvia_en_mediciones == 0
                   else f"se registraron {fmt(a.lluvia_en_mediciones)} mm de precipitación durante los intervalos de medición")
        t["precipitacion"] = (
            f"Durante los días de monitoreo se registró una precipitación acumulada de {fmt(total_lluvia)} mm, "
            f"distribuida así: {'; '.join(con_lluvia)}. De acuerdo con los registros horarios, {durante}.")

    if a.frecuencias:
        totales = sorted(((sum(p), d) for d, p in a.frecuencias.items()), reverse=True)
        (p1, d1), (p2, d2) = totales[0], totales[1]
        clase_max = max(range(len(a.clases_pct)), key=lambda i: a.clases_pct[i]) if a.clases_pct else None
        texto = (f"De acuerdo con los datos procesados para los días de monitoreo, los vientos tienen una predominancia "
                 f"principalmente desde el {NOMBRES_DIRECCION[d1]} ({d1})")
        if p2 > 0:
            texto += f" seguidos de la dirección {NOMBRES_DIRECCION[d2]} ({d2})"
        texto += ", como se puede observar en la Gráfica 4. Del total de mediciones del viento, "
        texto += (f"el {fmt(p1)}% y el {fmt(p2)}% provienen de dichas direcciones" if p2 > 0
                  else f"el {fmt(p1)}% proviene de dicha dirección")
        texto += f", y el {fmt(a.calmas_pct)}% corresponde a calmas (velocidad inferior a {fmt(LIMITE_CALMA)} m/s)."
        if clase_max is not None:
            lo, hi = CLASES_VIENTO[clase_max]
            rango = f"de {fmt(lo)} m/s a {fmt(hi)} m/s" if hi else f"mayor o igual a {fmt(lo)} m/s"
            texto += (f" Adicionalmente, la mayor frecuencia de velocidades del viento estuvo en el rango {rango}, "
                      f"con un {fmt(a.clases_pct[clase_max], 1)}% de los registros.")
        t["viento"] = texto
    else:
        t["viento"] = "No se dispone de registros de viento para los días de monitoreo."

    vmax = a.viento_max_en_mediciones
    if vmax is not None and vmax < 3:
        t["viento_mediciones"] = (
            "Cabe aclarar que en el momento en que se realizaron las mediciones en periodo diurno y nocturno, se "
            f"presentaron velocidades de viento inferiores a 3 m/s (valor máximo registrado: {fmt(vmax)} m/s), "
            "dichos datos se encuentran consignados en el Anexo 4. Registros de Campo, dando cumplimiento así con lo "
            "establecido en la normatividad ambiental vigente en materia de la ejecución de los monitoreos de Ruido.")
    elif vmax is not None:
        t["viento_mediciones"] = (
            "Durante los intervalos de medición la estación meteorológica registró velocidades de viento de hasta "
            f"{fmt(vmax)} m/s, superiores al límite de 3 m/s establecido en la Resolución 0627 de 2006 para la "
            "ejecución de los monitoreos de ruido; los datos se encuentran consignados en el Anexo 4. Registros de "
            "Campo.")
    return t


# ---------------------------------------------------------------- graficas
COLORES_CLASES = ["#C3DFC6", "#FFFF00", "#FF0000", "#0000FF", "#008000"]
COLOR_COLUMNAS = "#B5D30A"  # verde de las graficas diarias del informe
COLOR_BORDE_GRAFICA = "#92D050"


def _tope_eje(maximo: float) -> float:
    """Limite superior 'redondo' del eje Y, con espacio para las etiquetas."""
    objetivo = maximo * 1.2
    for paso in (5, 10, 20, 50, 100, 200, 500):
        if objetivo / paso <= 10:
            return paso * math.ceil(objetivo / paso)
    return objetivo


def generar_graficas_meteo(a: AnalisisMeteo, carpeta: str) -> dict:
    """Genera temperatura, humedad y presion (columnas con el promedio de
    cada dia de medicion), rosa de vientos y distribucion de clases de viento."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    os.makedirs(carpeta, exist_ok=True)
    rutas = {}

    def columnas(attr, titulo, ylabel, nombre, y_max=None, paso=None):
        """Columnas con el promedio diario (estilo de las graficas del informe):
        barras verdes con borde negro, valor sobre cada barra, fondo gris con
        lineas guia, eje Y desde 0 y fechas AAAA-MM-DD."""
        dias = [(d.dia, getattr(d, attr)) for d in a.dias if getattr(d, attr) is not None]
        if not dias:
            return
        etiquetas = [d.isoformat() for d, _ in dias]
        valores = [v for _, v in dias]
        ancho = max(7.5, min(12.0, 1.6 + 1.25 * len(dias)))
        fig, ax = plt.subplots(figsize=(ancho, 3.9), dpi=150)
        fig.patch.set_edgecolor(COLOR_BORDE_GRAFICA)
        fig.patch.set_linewidth(2)
        ax.set_facecolor("#F0F0F0")
        barras = ax.bar(etiquetas, valores, width=0.4, color=COLOR_COLUMNAS, edgecolor="black", linewidth=0.8,
                        zorder=3)
        tope = y_max if y_max is not None else _tope_eje(max(valores))
        # Espacio para la etiqueta de valor sobre la barra mas alta.
        while paso and max(valores) > tope * 0.88:
            tope += paso
        ax.set_ylim(0, tope)
        if paso:
            ax.set_yticks(np.arange(0, tope + paso / 2, paso))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:.0f}"))
        for b, v in zip(barras, valores):
            ax.annotate(fmt(v), (b.get_x() + b.get_width() / 2, v), xytext=(0, 4), textcoords="offset points",
                        ha="center", va="bottom", fontsize=11, zorder=5,
                        bbox=dict(boxstyle="square,pad=0.25", facecolor="white", edgecolor="none"))
        ax.grid(axis="y", color="#A6A6A6", linewidth=0.8, zorder=0)
        ax.set_axisbelow(True)
        for lado in ("top", "right"):
            ax.spines[lado].set_visible(False)
        ax.set_title(titulo, fontsize=13, fontweight="bold")
        ax.set_ylabel(ylabel, fontsize=11, fontweight="bold")
        ax.set_xlabel("Fechas de monitoreo", fontsize=11, labelpad=8)
        ax.tick_params(axis="x", labelsize=8.5, length=0)
        ax.tick_params(axis="y", labelsize=10)
        fig.tight_layout(pad=1.2)
        ruta = os.path.join(carpeta, nombre)
        fig.savefig(ruta, edgecolor=fig.get_edgecolor())
        plt.close(fig)
        rutas[attr] = ruta

    columnas("temperatura", "Temperatura Ambiente Diaria", "Temperatura (°C)", "meteo_temperatura.png")
    columnas("humedad", "Humedad Relativa Diaria", "Humedad relativa (%)", "meteo_humedad.png", y_max=100, paso=10)
    columnas("presion", "Presión Atmosférica Diaria", "Presión atmosférica (mm Hg)", "meteo_presion.png",
             y_max=1000, paso=100)
    lluvias = [d.lluvia for d in a.dias if d.lluvia is not None]
    if lluvias:
        # Precipitacion acumulada por dia (grafica del informe de emision); con dias
        # sin lluvia el eje queda de 0 a 5 mm para que las columnas en cero se lean.
        columnas("lluvia", "Precipitación Acumulada Diaria", "Precipitación (mm)", "meteo_precipitacion.png",
                 y_max=None if max(lluvias) > 0 else 5, paso=None if max(lluvias) > 0 else 1)

    if a.frecuencias:
        # Distribucion de clases (incluye calmas).
        etiquetas = ["Calmas"] + [f"{fmt(lo)} - {fmt(hi)}" if hi else f">= {fmt(lo)}" for lo, hi in CLASES_VIENTO]
        valores = [a.calmas_pct] + a.clases_pct
        fig, ax = plt.subplots(figsize=(5.5, 5), dpi=150)
        barras = ax.bar(etiquetas, valores, color="#8B1A1A", edgecolor="black", linewidth=0.6, zorder=3)
        for b, v in zip(barras, valores):
            if v > 0:
                ax.annotate(fmt(v, 1), (b.get_x() + b.get_width() / 2, v), ha="center", va="bottom", fontsize=8)
        ax.set_title("Distribución de frecuencias por clase de viento")
        ax.set_xlabel("Clase de viento (m/s)")
        ax.set_ylabel("%")
        ax.set_ylim(0, max(valores) * 1.15 + 1)
        ax.grid(axis="y", linestyle="--", alpha=0.5, zorder=0)
        plt.setp(ax.get_xticklabels(), fontsize=7)
        fig.tight_layout()
        ruta = os.path.join(carpeta, "meteo_clases_viento.png")
        fig.savefig(ruta)
        plt.close(fig)
        rutas["clases_viento"] = ruta

        # Rosa de vientos: barras apiladas por clase en 16 sectores.
        fig = plt.figure(figsize=(7.2, 5.6), dpi=150)
        fig.suptitle("Rosa de vientos", y=0.97)
        ax = fig.add_axes([0.05, 0.07, 0.6, 0.78], projection="polar")
        ax.set_theta_zero_location("N")
        ax.set_theta_direction(-1)
        angulos = np.radians(np.arange(16) * 22.5)
        ancho = np.radians(22.5) * 0.9
        base = np.zeros(16)
        for i, (lo, hi) in enumerate(CLASES_VIENTO):
            vals = np.array([a.frecuencias[d][i] for d in DIRECCIONES_16])
            if vals.sum() == 0:
                continue
            etiqueta = f"{fmt(lo)} - {fmt(hi)}" if hi else f">= {fmt(lo)}"
            ax.bar(angulos, vals, width=ancho, bottom=base, color=COLORES_CLASES[i], edgecolor="black",
                   linewidth=0.5, label=etiqueta, zorder=3)
            base += vals
        ax.set_xticks(angulos)
        ax.set_xticklabels([d.replace("W", "O") for d in DIRECCIONES_16], fontsize=8)
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:.0f}%"))
        ax.tick_params(axis="y", labelsize=7)
        ax.grid(linestyle="--", alpha=0.6)
        ax.legend(title="Velocidad (m/s)", loc="center left", bbox_to_anchor=(1.12, 0.4), fontsize=8,
                  title_fontsize=8, frameon=False)
        fig.text(0.72, 0.16, f"Calmas: {fmt(a.calmas_pct)} %", fontsize=8)
        if a.vector_resultante:
            fig.text(0.72, 0.11, f"Vector resultante: {a.vector_resultante[0]:.0f}° - "
                     f"{fmt(a.vector_resultante[1], 0)} %", fontsize=8)
        ruta = os.path.join(carpeta, "meteo_rosa_vientos.png")
        fig.savefig(ruta)
        plt.close(fig)
        rutas["rosa_vientos"] = ruta

        # Rosa y distribucion de clases lado a lado, en una sola imagen: la
        # Grafica de viento del informe es un unico dibujo de ~13 x 6 cm.
        rosa, clases = plt.imread(rutas["rosa_vientos"]), plt.imread(rutas["clases_viento"])
        proporciones = [rosa.shape[1] / rosa.shape[0], clases.shape[1] / clases.shape[0]]
        fig = plt.figure(figsize=(5 * sum(proporciones), 5), dpi=150)
        izquierda = proporciones[0] / sum(proporciones)
        for img, (x0, ancho_rel) in zip((rosa, clases), ((0, izquierda), (izquierda, 1 - izquierda))):
            ax = fig.add_axes([x0, 0, ancho_rel, 1])
            ax.imshow(img)
            ax.axis("off")
        ruta = os.path.join(carpeta, "meteo_viento.png")
        fig.savefig(ruta)
        plt.close(fig)
        rutas["viento_combinado"] = ruta
    return rutas


def filas_frecuencia_direcciones(a: AnalisisMeteo) -> list:
    """Filas [direccion, %] de las direcciones con registros (orden de la rosa) y las calmas,
    para la tabla que acompana la grafica de viento."""
    filas = [[d, fmt(sum(a.frecuencias[d]))] for d in DIRECCIONES_16 if sum(a.frecuencias.get(d, [])) > 0]
    return filas + [["Calms", fmt(a.calmas_pct)]]


def filas_tabla_diaria(a: AnalisisMeteo) -> list:
    """Filas de la tabla 'Datos meteorologicos durante los dias de monitoreo'
    (dias + Promedio/Maximo/Minimo)."""
    filas = [[d.dia.isoformat(), fmt(d.temperatura), fmt(d.humedad), fmt(d.presion), fmt(d.lluvia), fmt(d.viento)]
             for d in a.dias]
    attrs = ["temperatura", "humedad", "presion", "lluvia", "viento"]
    for nombre, fn in (("Promedio", _media), ("Máximo", max), ("Mínimo", min)):
        fila = [nombre]
        for at in attrs:
            vals = [getattr(d, at) for d in a.dias if getattr(d, at) is not None]
            fila.append(fmt(fn(vals)) if vals else "—")
        filas.append(fila)
    return filas
