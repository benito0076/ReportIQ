"""Genera el mapa de isofonas (curvas de igual nivel de presion sonora) por
cada esquema de jornada (DH, DNH, NDH, NDNH) a partir de los niveles LRAeq,1h
resultantes de cada punto y su coordenada real (Origen Nacional u otro
sistema plano en metros, o lat/long en grados).

Usa interpolacion IDW (Inverse Distance Weighting) sobre una malla regular
-el metodo estandar para este tipo de mapas cuando se cuenta con pocos
puntos de monitoreo (3-8)- y arma un plano con el mismo formato de layout
que se usa actualmente en los informes: mapa con imagen satelital real de
fondo, isolineas etiquetadas, cuadricula de coordenadas Origen Nacional en
los 4 lados, rosa de los vientos, y una columna lateral con: mapa de
localizacion general, leyenda de puntos de monitoreo, leyenda de la escala
de niveles LAeq dB(A), cuadro con el nombre del proyecto, cuadro de
"elaboro" y escala grafica."""
from __future__ import annotations

import logging
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import BoundaryNorm, ListedColormap
from matplotlib.ticker import FuncFormatter

from .geo import parsear_coordenada
from .geo_colombia import (
    geografica_a_origen_nacional,
    origen_nacional_a_web_mercator,
    web_mercator_a_geografica,
)
from .models import ESQUEMA_LABELS

# Escala de clasificacion de niveles LAeq dB(A): (nombre del color, rango,
# color hex), igual a la usada en los planos de isofonas de referencia.
ESCALA_COLORES = [
    ("Verde claro", "< 35", "#AAD962"),
    ("Verde", "35 - 40", "#78C679"),
    ("Verde oscuro", "40 - 45", "#31A354"),
    ("Amarillo", "45 - 50", "#FFFF33"),
    ("Ocre", "50 - 55", "#D4A017"),
    ("Naranja", "55 - 60", "#F4811F"),
    ("Cinabrio", "60 - 65", "#E31A1C"),
    ("Carmin", "65 - 70", "#B10026"),
    ("Rojo lila", "70 - 75", "#C71585"),
    ("Azul", "75 - 80", "#3399CC"),
    ("Azul oscuro", "80 - 85", "#08306B"),
]
BINS_DB = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85]
COLORES_PUNTOS = [
    "#17BECF", "#E377C2", "#FF7F0E", "#2CA02C", "#D62728",
    "#9467BD", "#8C564B", "#BCBD22", "#7F7F7F", "#1F77B4",
]

COLOR_TITULO_CAJA = "#1F3864"
COMPANIA_DEFECTO = "AMBIENCIQ INGENIEROS S.A.S."
# Logo de la empresa (con su nombre) para el cuadro "ELABORO"; si el archivo
# no existe se escribe el texto de `elaborado_por`.
LOGO_DEFECTO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "templates", "logo_empresa.png")


class SinCoordenadasError(Exception):
    pass


def _idw(xs, ys, valores, grid_x, grid_y, power=2.0):
    xs = np.asarray(xs, dtype=float)
    ys = np.asarray(ys, dtype=float)
    valores = np.asarray(valores, dtype=float)

    gx = grid_x.ravel()
    gy = grid_y.ravel()
    dist = np.sqrt((gx[:, None] - xs[None, :]) ** 2 + (gy[:, None] - ys[None, :]) ** 2)
    dist[dist < 1e-9] = 1e-9
    pesos = 1.0 / (dist ** power)
    resultado = (pesos * valores[None, :]).sum(axis=1) / pesos.sum(axis=1)
    return resultado.reshape(grid_x.shape)


def puntos_con_coordenadas(proyecto):
    """Devuelve [(punto, x, y)] para los puntos que tienen coordenadas
    numericas validas (en punto.longitud / punto.latitud)."""
    salida = []
    for p in proyecto.puntos:
        x = parsear_coordenada(p.longitud)
        y = parsear_coordenada(p.latitud)
        if x is not None and y is not None:
            salida.append((p, x, y))
    return salida


_log = logging.getLogger(__name__)

# Motivo del ultimo fallo al descargar el mapa base (None si no hubo fallo):
# permite informar al usuario por que un mapa salio sin fondo satelital.
ultimo_error_mapa_base = None


def _agregar_mapa_base(ax, zoom=None) -> bool:
    """Intenta superponer un mapa satelital real (Esri World Imagery) via
    contextily. Devuelve True si lo logro, False si no hay libreria o
    conexion a internet (en ese caso el mapa queda con fondo simple y el
    motivo queda en `ultimo_error_mapa_base` y en el log)."""
    global ultimo_error_mapa_base
    try:
        import contextily as cx
        kwargs = {"crs": "EPSG:3857", "source": cx.providers.Esri.WorldImagery, "attribution_size": 5}
        if zoom is not None:
            kwargs["zoom"] = zoom
        cx.add_basemap(ax, **kwargs)
        return True
    except Exception as exc:  # noqa: BLE001  (sin internet, libreria ausente, servidor caido...)
        ultimo_error_mapa_base = f"{type(exc).__name__}: {exc}"[:500]
        _log.warning("No se pudo agregar el mapa base satelital", exc_info=True)
        return False


def _redondear_bonito(valor):
    if valor <= 0:
        return 1.0
    exponente = 10 ** (len(str(int(valor))) - 1)
    for base in (1, 2, 5, 10):
        if base * exponente >= valor:
            return base * exponente
    return exponente * 10


def _caja(fig, rect, titulo=None, alto_titulo=0.10):
    """Crea una caja con borde negro y, opcionalmente, una barra de titulo
    (fondo azul oscuro, texto blanco), estilo de las leyendas del plano de
    referencia. Devuelve el Axes (coordenadas 0-1 en x/y) para dibujar el
    contenido debajo del titulo."""
    ax = fig.add_axes(rect)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.add_patch(mpatches.Rectangle((0, 0), 1, 1, fill=False, edgecolor="black",
                                     linewidth=0.9, transform=ax.transAxes, zorder=5))
    if titulo:
        ax.add_patch(mpatches.Rectangle((0, 1 - alto_titulo), 1, alto_titulo,
                                         facecolor=COLOR_TITULO_CAJA, edgecolor="none",
                                         transform=ax.transAxes, zorder=4))
        ax.text(0.5, 1 - alto_titulo / 2, titulo, ha="center", va="center",
                color="white", fontsize=7.5, fontweight="bold", transform=ax.transAxes, zorder=6)
    return ax


def _dibujar_leyenda_puntos(fig, rect, nombres, colores):
    n = len(nombres)
    alto_titulo = min(0.22, 0.5 / max(n, 1))
    ax = _caja(fig, rect, "PUNTOS DE MONITOREO", alto_titulo=alto_titulo)
    disponible = 1 - alto_titulo
    paso = disponible / n
    for i, (nombre, color) in enumerate(zip(nombres, colores)):
        y = 1 - alto_titulo - paso * (i + 0.5)
        ax.scatter([0.10], [y], s=90, c=color, edgecolors="black", linewidths=1.0, zorder=6)
        ax.text(0.20, y, nombre, ha="left", va="center", fontsize=7, transform=ax.transAxes)


def _dibujar_leyenda_escala(fig, rect):
    n = len(ESCALA_COLORES)
    alto_titulo = 0.10
    ax = _caja(fig, rect, "ESCALA DE NIVELES DE\nPRESION SONORA LAeq dB(A)", alto_titulo=alto_titulo)
    disponible = 1 - alto_titulo
    paso = disponible / n
    for i, (nombre, rango, color) in enumerate(ESCALA_COLORES):
        y0 = 1 - alto_titulo - paso * (i + 1)
        ax.add_patch(mpatches.Rectangle((0.04, y0 + paso * 0.12), 0.5, paso * 0.76,
                                         facecolor=color, edgecolor="black", linewidth=0.5,
                                         transform=ax.transAxes))
        ax.text(0.30, y0 + paso * 0.5, nombre, ha="center", va="center", fontsize=6.2,
                transform=ax.transAxes)
        ax.text(0.78, y0 + paso * 0.5, rango, ha="center", va="center", fontsize=6.5,
                transform=ax.transAxes)


def _dibujar_info_proyecto(fig, rect, lineas):
    ax = _caja(fig, rect, "PROYECTO", alto_titulo=0.22)
    texto = "\n".join(lineas)
    ax.text(0.5, (1 - 0.22) / 2, texto, ha="center", va="center", fontsize=7,
            fontweight="bold", transform=ax.transAxes, wrap=True)


def _dibujar_elaborado(fig, rect, texto, logo_ruta=None):
    """Cuadro ELABORO: el logo de la empresa (que ya incluye su nombre)
    centrado; si no hay logo disponible, el texto `texto`."""
    alto_titulo = 0.30
    ax = _caja(fig, rect, "ELABORO", alto_titulo=alto_titulo)
    if logo_ruta and os.path.exists(logo_ruta):
        try:
            imagen = plt.imread(logo_ruta)
            # El logo ocupa el espacio bajo el titulo sin deformarse: se ajusta
            # al alto o al ancho disponible segun la proporcion real de la caja.
            ancho_fig, alto_fig = fig.get_size_inches()
            caja_w_in = rect[2] * ancho_fig * 0.9
            caja_h_in = rect[3] * alto_fig * (1 - alto_titulo) * 0.78
            proporcion = imagen.shape[1] / imagen.shape[0]
            if caja_w_in / caja_h_in > proporcion:
                h_in, w_in = caja_h_in, caja_h_in * proporcion
            else:
                w_in, h_in = caja_w_in, caja_w_in / proporcion
            w_rel = w_in / (rect[2] * ancho_fig)
            h_rel = h_in / (rect[3] * alto_fig)
            sub = ax.inset_axes([(1 - w_rel) / 2, (1 - alto_titulo - h_rel) / 2, w_rel, h_rel])
            sub.imshow(imagen)
            sub.axis("off")
            return
        except Exception:  # noqa: BLE001  (logo danado: se usa el texto)
            pass
    ax.text(0.5, (1 - alto_titulo) / 2, texto, ha="center", va="center", fontsize=7.5,
            fontweight="bold", transform=ax.transAxes, wrap=True)


def _dibujar_escala_grafica_caja(fig, rect, ancho_mapa_m):
    ax = _caja(fig, rect, "ESCALA GRAFICA", alto_titulo=0.30)
    longitud_total = _redondear_bonito(ancho_mapa_m * 0.6)
    n_segmentos = 4
    seg = longitud_total / n_segmentos
    x0, y0 = 0.08, 0.42
    ancho_barra = 0.84
    escala_px = ancho_barra / longitud_total
    for i in range(n_segmentos):
        color = "black" if i % 2 == 0 else "white"
        ax.add_patch(mpatches.Rectangle((x0 + i * seg * escala_px, y0), seg * escala_px, 0.10,
                                         facecolor=color, edgecolor="black", linewidth=0.6,
                                         transform=ax.transAxes))
        ax.text(x0 + i * seg * escala_px, y0 - 0.08, f"{i * seg / 1000:.2g}",
                ha="center", va="top", fontsize=5.5, transform=ax.transAxes)
    ax.text(x0 + n_segmentos * seg * escala_px, y0 - 0.08, f"{longitud_total / 1000:.2g}",
            ha="center", va="top", fontsize=5.5, transform=ax.transAxes)
    ax.text(x0 + ancho_barra + 0.02, y0 + 0.05, "km", ha="left", va="center", fontsize=6,
            transform=ax.transAxes)
    ax.text(0.5, 0.14, f"1 cm en el mapa ≈ {longitud_total / 1000 / (ancho_barra * 10):.2g} km",
            ha="center", va="center", fontsize=5.5, transform=ax.transAxes)


def _dibujar_localizacion(fig, rect, x_centro, y_centro, extent_detalle, con_basemap):
    ax = _caja(fig, rect, "LOCALIZACION GENERAL", alto_titulo=0.12)
    sub = fig.add_axes(rect, zorder=1)
    pos = ax.get_position()
    margen = 0.10
    sub.set_position([pos.x0 + margen * pos.width, pos.y0 + margen * pos.height,
                       pos.width * (1 - 2 * margen), pos.height * (1 - 2 * margen) * 0.88])
    radio = max(extent_detalle[1] - extent_detalle[0], extent_detalle[3] - extent_detalle[2]) * 6
    sub.set_xlim(x_centro - radio, x_centro + radio)
    sub.set_ylim(y_centro - radio, y_centro + radio)
    ok = _agregar_mapa_base(sub) if con_basemap else False
    if not ok:
        sub.set_facecolor("#cfe0cf")
    ancho_d = extent_detalle[1] - extent_detalle[0]
    alto_d = extent_detalle[3] - extent_detalle[2]
    sub.add_patch(mpatches.Rectangle(
        (extent_detalle[0] - ancho_d * 0.35, extent_detalle[2] - alto_d * 0.35),
        ancho_d * 1.7, alto_d * 1.7,
        fill=False, edgecolor="red", linewidth=1.5, zorder=6,
    ))
    sub.set_xticks([])
    sub.set_yticks([])
    for spine in sub.spines.values():
        spine.set_visible(True)
        spine.set_linewidth(0.6)


def _dibujar_rosa_vientos(ax):
    """Rosa de los vientos simplificada de 4 puntas (triangulos alternando
    blanco/negro), con las etiquetas N/S/E/W, en la esquina superior
    izquierda del mapa."""
    cx_f, cy_f, r_f = 0.075, 0.90, 0.045  # posicion y radio, en fraccion de ejes
    trans = ax.transAxes
    puntas = [(0, 1, "N"), (1, 0, "E"), (0, -1, "S"), (-1, 0, "O")]
    for i in range(4):
        dx, dy, _ = puntas[i]
        dx2, dy2, _ = puntas[(i + 1) % 4]
        color = "black" if i % 2 == 0 else "white"
        tri = mpatches.Polygon(
            [(cx_f, cy_f), (cx_f + dx * r_f, cy_f + dy * r_f), (cx_f + dx2 * r_f, cy_f + dy2 * r_f)],
            closed=True, facecolor=color, edgecolor="black", linewidth=0.6,
            transform=trans, zorder=8,
        )
        ax.add_patch(tri)
    halo = [pe.withStroke(linewidth=2.5, foreground="white")]
    ax.text(cx_f, cy_f + r_f * 1.6, "N", ha="center", va="center", fontsize=8,
            fontweight="bold", transform=trans, zorder=9, path_effects=halo)


def generar_mapa_isofonas_esquema(resultados_proyecto, esquema: str, ruta_salida: str,
                                   titulo: str = "", con_basemap: bool = True,
                                   elaborado_por: str = COMPANIA_DEFECTO, generar_pdf: bool = True,
                                   logo_ruta: str = LOGO_DEFECTO):
    """Genera el mapa de isofonas para un esquema especifico (DH, DNH, NDH o
    NDNH), con el formato de plano usado actualmente (mapa satelital real,
    isolineas, cuadricula Origen Nacional, y columna lateral con
    localizacion general, leyenda de puntos, leyenda de niveles, cuadro de
    proyecto, elaboro y escala grafica)."""
    proyecto = resultados_proyecto.proyecto
    con_coords = puntos_con_coordenadas(proyecto)
    if len(con_coords) < 3:
        raise SinCoordenadasError(
            "Se necesitan al menos 3 puntos con coordenadas (Este/Longitud y "
            "Norte/Latitud) para poder interpolar el mapa de isofonas."
        )

    puntos_validos = []
    for punto, x, y in con_coords:
        rp = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema)
        if rp is None or rp.lraeq_resultante is None:
            continue
        puntos_validos.append((punto, x, y, rp.lraeq_resultante))

    if len(puntos_validos) < 3:
        raise SinCoordenadasError(
            f"Se necesitan al menos 3 puntos con resultados calculados para el esquema "
            f"'{ESQUEMA_LABELS.get(esquema, esquema)}' y con coordenadas asignadas."
        )

    nombres = [p.nombre for p, _, _, _ in puntos_validos]
    valores = [v for _, _, _, v in puntos_validos]
    xs, ys = [], []
    for _, x, y, _ in puntos_validos:
        xm, ym = origen_nacional_a_web_mercator(x, y)
        xs.append(xm)
        ys.append(ym)

    margen_x = max((max(xs) - min(xs)) * 0.35, 80)
    margen_y = max((max(ys) - min(ys)) * 0.35, 80)
    x_min, x_max = min(xs) - margen_x, max(xs) + margen_x
    y_min, y_max = min(ys) - margen_y, max(ys) + margen_y

    resolucion = 220
    grid_x, grid_y = np.meshgrid(
        np.linspace(x_min, x_max, resolucion), np.linspace(y_min, y_max, resolucion)
    )
    campo = _idw(xs, ys, valores, grid_x, grid_y)

    limites = [-1000.0] + BINS_DB
    cmap = ListedColormap([c for _, _, c in ESCALA_COLORES])
    cmap.set_over(ESCALA_COLORES[-1][2])
    norm = BoundaryNorm(limites, cmap.N)

    # --- Layout general: mapa a la izquierda + columna lateral de leyendas ---
    fig = plt.figure(figsize=(15, 9.2), dpi=150)
    ax = fig.add_axes([0.045, 0.07, 0.66, 0.87])
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)

    mapa_ok = _agregar_mapa_base(ax) if con_basemap else False
    alpha_relleno = 0.55 if mapa_ok else 1.0
    if not mapa_ok:
        ax.set_facecolor("#dddddd")

    cf = ax.contourf(grid_x, grid_y, campo, levels=limites, cmap=cmap, norm=norm,
                      extend="max", alpha=alpha_relleno, zorder=2)
    contornos = ax.contour(grid_x, grid_y, campo, levels=BINS_DB, colors="white",
                            linewidths=1.1, zorder=3)
    etiquetas = ax.clabel(contornos, inline=True, fontsize=6.5, fmt="%d")
    for t in etiquetas:
        t.set_path_effects([pe.withStroke(linewidth=2, foreground="black")])

    colores_puntos = [COLORES_PUNTOS[i % len(COLORES_PUNTOS)] for i in range(len(xs))]
    ax.scatter(xs, ys, s=65, c=colores_puntos, edgecolors="black", linewidths=1.0, zorder=5)
    halo = [pe.withStroke(linewidth=3, foreground="white")]
    for nombre, x, y in zip(nombres, xs, ys):
        ax.annotate(nombre, (x, y), textcoords="offset points", xytext=(7, 6),
                    fontsize=8, fontweight="bold", color="black",
                    path_effects=halo, zorder=6)

    # Cuadricula y coordenadas Origen Nacional en los 4 lados del mapa.
    y_ref = (y_min + y_max) / 2
    x_ref = (x_min + x_max) / 2

    def _fmt_x(val, _pos):
        lat, lon = web_mercator_a_geografica(val, y_ref)
        este, _ = geografica_a_origen_nacional(lat, lon)
        return f"{este:,.0f}".replace(",", ".")

    def _fmt_y(val, _pos):
        lat, lon = web_mercator_a_geografica(x_ref, val)
        _, norte = geografica_a_origen_nacional(lat, lon)
        return f"{norte:,.0f}".replace(",", ".")

    ax.xaxis.set_major_formatter(FuncFormatter(_fmt_x))
    ax.yaxis.set_major_formatter(FuncFormatter(_fmt_y))
    ax.tick_params(axis="both", labelsize=6.5, top=True, labeltop=True, right=True, labelright=True)
    ax.grid(color="#b0c4de", alpha=0.55, linewidth=0.6, zorder=4)
    ax.set_title(titulo or f"Mapa de isofonas - {ESQUEMA_LABELS.get(esquema, esquema)}", fontsize=11)

    _dibujar_rosa_vientos(ax)

    if not mapa_ok and con_basemap:
        ax.text(
            0.5, -0.07, "Mapa base satelital no disponible (sin conexion a internet)",
            transform=ax.transAxes, ha="center", fontsize=7, color="#a00000",
        )

    # --- Columna lateral (leyendas), de arriba hacia abajo ---
    # Las alturas deseadas se escalan para que siempre quepan exactamente en
    # el espacio vertical disponible (evita que las cajas se superpongan
    # cuando hay muchos puntos, o queden con huecos cuando hay pocos).
    col_x, col_w = 0.735, 0.235
    y_top, y_bottom = 0.965, 0.02
    alto_disponible = y_top - y_bottom

    deseadas = {
        "localizacion": 0.20,
        "puntos": min(0.30, 0.05 + 0.026 * len(nombres)),
        "escala": 0.33,
        "proyecto": 0.11,
        "elaboro": 0.09,
        "grafica": 0.075,
    }
    gap_deseado = 0.014
    n_gaps = len(deseadas) - 1
    total_deseado = sum(deseadas.values()) + gap_deseado * n_gaps
    factor = min(1.0, alto_disponible / total_deseado)
    alturas = {k: v * factor for k, v in deseadas.items()}
    gap = gap_deseado * factor

    y_cursor = y_top
    y_cursor -= alturas["localizacion"]
    _dibujar_localizacion(fig, [col_x, y_cursor, col_w, alturas["localizacion"]],
                           (x_min + x_max) / 2, (y_min + y_max) / 2,
                           (x_min, x_max, y_min, y_max), con_basemap)

    y_cursor -= gap + alturas["puntos"]
    _dibujar_leyenda_puntos(fig, [col_x, y_cursor, col_w, alturas["puntos"]], nombres, colores_puntos)

    y_cursor -= gap + alturas["escala"]
    _dibujar_leyenda_escala(fig, [col_x, y_cursor, col_w, alturas["escala"]])

    y_cursor -= gap + alturas["proyecto"]
    lineas_proyecto = [l for l in [proyecto.cliente, proyecto.nombre_proyecto,
                                    f"RUIDO AMBIENTAL - {ESQUEMA_LABELS.get(esquema, esquema).upper()}"] if l]
    _dibujar_info_proyecto(fig, [col_x, y_cursor, col_w, alturas["proyecto"]], lineas_proyecto or ["PROYECTO"])

    y_cursor -= gap + alturas["elaboro"]
    _dibujar_elaborado(fig, [col_x, y_cursor, col_w, alturas["elaboro"]], elaborado_por, logo_ruta)

    y_cursor -= gap + alturas["grafica"]
    _dibujar_escala_grafica_caja(fig, [col_x, y_cursor, col_w, alturas["grafica"]], x_max - x_min)

    os.makedirs(os.path.dirname(ruta_salida) or ".", exist_ok=True)
    fig.savefig(ruta_salida)
    if generar_pdf:
        ruta_pdf = os.path.splitext(ruta_salida)[0] + ".pdf"
        fig.savefig(ruta_pdf)
    plt.close(fig)
    return ruta_salida


def generar_mapas_isofonas(resultados_proyecto, carpeta_salida: str, con_basemap: bool = True,
                            generar_pdf: bool = True):
    """Genera un mapa de isofonas (.png y, por defecto, tambien .pdf) por
    cada esquema (DH, DNH, NDH, NDNH) que tenga datos calculados. Devuelve
    {esquema: ruta_png} y no lanza error si algun esquema no se puede
    generar (falta de coordenadas o resultados); en ese caso simplemente no
    aparece en el diccionario devuelto."""
    rutas = {}
    for esquema in ESQUEMA_LABELS:
        try:
            rutas[esquema] = generar_mapa_isofonas_esquema(
                resultados_proyecto, esquema,
                os.path.join(carpeta_salida, f"isofonas_{esquema}.png"),
                con_basemap=con_basemap, generar_pdf=generar_pdf,
            )
        except SinCoordenadasError:
            continue
    return rutas


def generar_mapa_localizacion(proyecto, ruta_salida: str, con_basemap: bool = True,
                              elaborado_por: str = COMPANIA_DEFECTO, logo_ruta: str = LOGO_DEFECTO,
                              generar_pdf: bool = False,
                              titulo: str = "LOCALIZACIÓN DE PUNTOS - RUIDO AMBIENTAL"):
    """Plano de localizacion de los puntos de monitoreo (Imagen 1 del informe):
    imagen satelital, puntos con su nombre, cuadricula Origen Nacional y la
    misma columna lateral de los mapas de isofonas (localizacion general,
    leyenda de puntos, proyecto, elaboro y escala grafica). Necesita al menos
    un punto con coordenadas."""
    con_coords = puntos_con_coordenadas(proyecto)
    if not con_coords:
        raise SinCoordenadasError("Ningun punto tiene coordenadas para el mapa de localizacion.")

    nombres = [p.nombre for p, _, _ in con_coords]
    xs, ys = [], []
    for _, x, y in con_coords:
        xm, ym = origen_nacional_a_web_mercator(x, y)
        xs.append(xm)
        ys.append(ym)

    ancho = max(max(xs) - min(xs), max(ys) - min(ys), 300)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    # Encuadre con margen y proporcion similar a la del area del mapa.
    medio_x = ancho * 0.5 * 1.35 * 1.2
    medio_y = ancho * 0.5 * 1.35
    x_min, x_max, y_min, y_max = cx - medio_x, cx + medio_x, cy - medio_y, cy + medio_y

    fig = plt.figure(figsize=(15, 9.2), dpi=150)
    ax = fig.add_axes([0.045, 0.07, 0.66, 0.87])
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    ax.set_aspect("equal", adjustable="datalim")  # sin deformar el terreno
    mapa_ok = _agregar_mapa_base(ax) if con_basemap else False
    if not mapa_ok:
        ax.set_facecolor("#dddddd")

    colores = [COLORES_PUNTOS[i % len(COLORES_PUNTOS)] for i in range(len(xs))]
    ax.scatter(xs, ys, s=90, c=colores, edgecolors="black", linewidths=1.2, zorder=5)
    halo = [pe.withStroke(linewidth=3, foreground="white")]
    for nombre, x, y in zip(nombres, xs, ys):
        ax.annotate(nombre, (x, y), textcoords="offset points", xytext=(8, 7), fontsize=9,
                    fontweight="bold", color="black", path_effects=halo, zorder=6)

    y_ref, x_ref = (y_min + y_max) / 2, (x_min + x_max) / 2

    def _fmt_x(val, _pos):
        lat, lon = web_mercator_a_geografica(val, y_ref)
        return f"{geografica_a_origen_nacional(lat, lon)[0]:,.0f}".replace(",", ".")

    def _fmt_y(val, _pos):
        lat, lon = web_mercator_a_geografica(x_ref, val)
        return f"{geografica_a_origen_nacional(lat, lon)[1]:,.0f}".replace(",", ".")

    ax.xaxis.set_major_formatter(FuncFormatter(_fmt_x))
    ax.yaxis.set_major_formatter(FuncFormatter(_fmt_y))
    ax.tick_params(axis="both", labelsize=6.5, top=True, labeltop=True, right=True, labelright=True)
    ax.grid(color="#b0c4de", alpha=0.55, linewidth=0.6, zorder=4)
    ax.set_title("Localización de los puntos de monitoreo de ruido ambiental", fontsize=11)
    _dibujar_rosa_vientos(ax)
    if not mapa_ok and con_basemap:
        ax.text(0.5, -0.07, "Mapa base satelital no disponible (sin conexion a internet)",
                transform=ax.transAxes, ha="center", fontsize=7, color="#a00000")

    col_x, col_w = 0.735, 0.235
    y_top, y_bottom = 0.965, 0.02
    deseadas = {"localizacion": 0.30, "puntos": min(0.30, 0.05 + 0.026 * len(nombres)),
                "proyecto": 0.13, "elaboro": 0.10, "grafica": 0.08}
    gap_deseado = 0.014
    total = sum(deseadas.values()) + gap_deseado * (len(deseadas) - 1)
    factor = min(1.0, (y_top - y_bottom) / total)
    alturas = {k: v * factor for k, v in deseadas.items()}
    gap = gap_deseado * factor

    y = y_top - alturas["localizacion"]
    _dibujar_localizacion(fig, [col_x, y, col_w, alturas["localizacion"]], cx, cy,
                          (x_min, x_max, y_min, y_max), con_basemap)
    y -= gap + alturas["puntos"]
    _dibujar_leyenda_puntos(fig, [col_x, y, col_w, alturas["puntos"]], nombres, colores)
    y -= gap + alturas["proyecto"]
    lineas = [l for l in [getattr(proyecto, "cliente", ""), proyecto.nombre_proyecto, titulo] if l]
    _dibujar_info_proyecto(fig, [col_x, y, col_w, alturas["proyecto"]], lineas)
    y -= gap + alturas["elaboro"]
    _dibujar_elaborado(fig, [col_x, y, col_w, alturas["elaboro"]], elaborado_por, logo_ruta)
    y -= gap + alturas["grafica"]
    _dibujar_escala_grafica_caja(fig, [col_x, y, col_w, alturas["grafica"]], x_max - x_min)

    os.makedirs(os.path.dirname(ruta_salida) or ".", exist_ok=True)
    fig.savefig(ruta_salida)
    if generar_pdf:
        fig.savefig(os.path.splitext(ruta_salida)[0] + ".pdf")
    plt.close(fig)
    return ruta_salida
