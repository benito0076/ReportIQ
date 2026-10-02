"""Graficas del informe de calidad del aire (matplotlib, PNG)."""
from __future__ import annotations

import os
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.collections import PolyCollection  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402
from matplotlib.ticker import FuncFormatter, MaxNLocator  # noqa: E402

from .aire import CATEGORIAS_ICA  # noqa: E402

PALETA = ["#2F5597", "#C55A11", "#548235", "#7030A0", "#BF9000", "#2E75B6", "#843C0C", "#3A3A3A"]
COLORES_ICA = {"Verde": "#00E400", "Amarillo": "#FFFF00", "Naranja": "#FF7E00", "Rojo": "#FF0000",
               "Púrpura": "#8F3F97", "Marrón": "#7E0023"}
_NUM = FuncFormatter(lambda v, _: f"{v:,.0f}".replace(",", ".") if v >= 10 else f"{v:g}".replace(".", ","))


def _guardar(fig, ruta):
    fig.tight_layout()
    fig.savefig(ruta, dpi=150)
    plt.close(fig)
    return ruta


def _fechas_eje(ax, fechas):
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    if len(fechas) > 20:
        ax.xaxis.set_major_locator(mdates.DayLocator(interval=2))
    else:
        ax.xaxis.set_major_locator(mdates.DayLocator())
    for t in ax.get_xticklabels():
        t.set_rotation(90)


def barras_diarias(series: dict, limite: float | None, titulo_y: str, ruta: str):
    """`series`: {estacion: [(fecha, valor)]}. Barras agrupadas por fecha y linea del limite."""
    fechas = sorted({f for datos in series.values() for f, v in datos if v is not None})
    if not fechas:
        return None
    fig, ax = plt.subplots(figsize=(10, 4.6))
    n = max(len(series), 1)
    ancho = 0.8 / n
    for k, (nombre, datos) in enumerate(series.items()):
        por_fecha = dict(datos)
        xs = [mdates.date2num(f) + (k - (n - 1) / 2) * ancho for f in fechas if por_fecha.get(f) is not None]
        ys = [por_fecha[f] for f in fechas if por_fecha.get(f) is not None]
        ax.bar(xs, ys, width=ancho, label=nombre, color=PALETA[k % len(PALETA)])
    if limite is not None:
        ax.axhline(limite, color="#C00000", linewidth=2, label=f"Límite máximo permisible ({_NUM(limite, 0)} µg/m³)")
    # Escala lineal: las barras parten de cero (como en Excel).
    ax.yaxis.set_major_formatter(_NUM)
    ax.set_ylabel(titulo_y)
    ax.set_xlabel("Fecha final de monitoreo")
    _fechas_eje(ax, fechas)
    ax.grid(axis="y", alpha=0.3)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.32), ncol=min(n + 1, 3), fontsize=8, frameon=False)
    return _guardar(fig, ruta)


def barras_horarias(pares: list, titulo_y: str, ruta: str, etiqueta: str):
    """Concentraciones horarias (u octohorarias) de una estacion en barras. Como en el
    informe ejemplo, sin el limite: se compara en la grafica de maximos diarios."""
    pares = [(t, v) for t, v in pares if v is not None]
    if not pares:
        return None
    fig, ax = plt.subplots(figsize=(10, 4.2))
    # Cientos de barras: una sola coleccion de rectangulos (ax.bar crea un objeto por
    # barra y es ~10 veces mas lento, mucho en el plan de 0,15 CPU de Render).
    medio = 0.4 / 24
    xs = [mdates.date2num(t) for t, _ in pares]
    ys = [v for _, v in pares]
    ax.add_collection(PolyCollection([[(x - medio, 0), (x - medio, y), (x + medio, y), (x + medio, 0)]
                                      for x, y in zip(xs, ys)], facecolors=PALETA[0], edgecolors="none"))
    ax.set_xlim(min(xs) - 0.5, max(xs) + 0.5)
    ax.set_ylim(min(0, min(ys)), max(ys) * 1.05 if max(ys) > 0 else 1)
    ax.xaxis_date()
    ax.legend(handles=[Patch(color=PALETA[0], label=etiqueta)], loc="upper center", bbox_to_anchor=(0.5, -0.3),
              fontsize=8, frameon=False)
    ax.yaxis.set_major_formatter(_NUM)
    ax.set_ylabel(titulo_y)
    ax.set_xlabel("Fecha de monitoreo")
    dias = {t.date() for t, _ in pares}
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.DayLocator(interval=2 if len(dias) > 20 else 1))
    for t in ax.get_xticklabels():
        t.set_rotation(90)
    ax.grid(axis="y", alpha=0.3)
    return _guardar(fig, ruta)


def ica_categorias(conteos: dict, ruta: str):
    """`conteos`: {estacion: {categoria: dias}}. Barras apiladas con los colores del ICA."""
    if not conteos:
        return None
    fig, ax = plt.subplots(figsize=(9, 4.2))
    nombres = list(conteos)
    base = [0] * len(nombres)
    for _, _, categoria, color in CATEGORIAS_ICA:
        valores = [conteos[n].get(categoria, 0) for n in nombres]
        if not any(valores):
            continue
        ax.barh(nombres, valores, left=base, color=COLORES_ICA[color], edgecolor="#555555", label=categoria)
        for i, v in enumerate(valores):
            if v:
                ax.text(base[i] + v / 2, i, str(v), ha="center", va="center", fontsize=9)
        base = [b + v for b, v in zip(base, valores)]
    ax.set_xlabel("Días de monitoreo")
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax.invert_yaxis()
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=3, fontsize=8, frameon=False)
    ax.tick_params(axis="y", labelsize=8)
    return _guardar(fig, ruta)


def meteo_diaria(dias: list, valores: list, titulo_y: str, ruta: str, color: str = PALETA[0], barras: bool = True):
    """Serie diaria de una variable meteorologica (barras)."""
    pares = [(d, v) for d, v in zip(dias, valores) if v is not None]
    if not pares:
        return None
    fig, ax = plt.subplots(figsize=(9, 3.8))
    xs = [mdates.date2num(d) for d, _ in pares]
    ys = [v for _, v in pares]
    if barras:
        ax.bar(xs, ys, color=color, width=0.7)
        bajo, alto = min(ys), max(ys)
        if bajo > 0 and (alto - bajo) < 0.2 * alto:
            # Variables con poca variacion relativa (presion, temperatura): el eje no
            # parte de cero para que se aprecien las diferencias, como en Excel.
            margen = max((alto - bajo) * 0.5, alto * 0.01)
            ax.set_ylim(bajo - margen, alto + margen * 0.5)
    else:
        ax.plot(xs, ys, marker="o", color=color, linewidth=1.6)
    ax.set_ylabel(titulo_y)
    _fechas_eje(ax, [d for d, _ in pares])
    ax.grid(alpha=0.3)
    return _guardar(fig, ruta)


def nombre_archivo(carpeta: str, *partes) -> str:
    base = "_".join(str(p) for p in partes)
    seguro = "".join(c if c.isalnum() else "_" for c in base)
    return os.path.join(carpeta, f"{seguro}.png")


__all__ = ["barras_diarias", "barras_horarias", "ica_categorias", "meteo_diaria", "nombre_archivo", "date"]
