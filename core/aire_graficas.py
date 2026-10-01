"""Graficas del informe de calidad del aire (matplotlib, PNG)."""
from __future__ import annotations

import os
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter, MaxNLocator, NullFormatter  # noqa: E402

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


def _log(ax):
    ax.set_yscale("log")
    ax.yaxis.set_minor_formatter(NullFormatter())


def _con_cortes(pares: list, horas: float = 2):
    """Inserta un hueco en la linea cuando faltan datos (p. ej. un dia sin medicion)."""
    xs, ys = [], []
    for i, (t, v) in enumerate(pares):
        if i and (t - pares[i - 1][0]).total_seconds() > horas * 3600:
            xs.append(t)
            ys.append(float("nan"))
        xs.append(t)
        ys.append(v)
    return xs, ys


def barras_diarias(series: dict, limite: float | None, titulo_y: str, ruta: str, log: bool = False):
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
    maximo = max((v for datos in series.values() for _, v in datos if v is not None), default=0)
    if log and limite and maximo and limite / maximo > 10:
        _log(ax)
    ax.yaxis.set_major_formatter(_NUM)
    ax.set_ylabel(titulo_y)
    ax.set_xlabel("Fecha final de monitoreo")
    _fechas_eje(ax, fechas)
    ax.grid(axis="y", alpha=0.3)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.32), ncol=min(n + 1, 3), fontsize=8, frameon=False)
    return _guardar(fig, ruta)


def serie_horaria(horas: list, medias_8h: list, limite_1h: float | None, limite_8h: float | None,
                  titulo_y: str, ruta: str, mostrar_1h: bool = True, mostrar_8h: bool = True):
    """Concentraciones horarias y/o media movil de 8 h de una estacion."""
    if not horas:
        return None
    fig, ax = plt.subplots(figsize=(10, 4.2))
    if mostrar_1h:
        ax.plot(*_con_cortes(horas), color=PALETA[0], linewidth=0.9, label="Concentración horaria")
    if mostrar_8h and medias_8h:
        ax.plot(*_con_cortes(medias_8h), color=PALETA[1], linewidth=1.4, label="Media móvil de 8 horas")
    if mostrar_1h and limite_1h is not None:
        ax.axhline(limite_1h, color="#C00000", linewidth=1.8, label=f"Límite 1 hora ({_NUM(limite_1h, 0)} µg/m³)")
    if mostrar_8h and limite_8h is not None:
        ax.axhline(limite_8h, color="#7F0000", linewidth=1.8, linestyle="--",
                   label=f"Límite 8 horas ({_NUM(limite_8h, 0)} µg/m³)")
    _log(ax)
    ax.yaxis.set_major_formatter(_NUM)
    ax.set_ylabel(titulo_y)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.DayLocator(interval=2 if len(horas) > 24 * 20 else 1))
    for t in ax.get_xticklabels():
        t.set_rotation(90)
    ax.grid(alpha=0.3)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.25), ncol=4, fontsize=8, frameon=False)
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


def meteo_diaria(dias: list, valores: list, titulo_y: str, ruta: str, color: str = PALETA[0], barras: bool = False):
    """Serie diaria de una variable meteorologica."""
    pares = [(d, v) for d, v in zip(dias, valores) if v is not None]
    if not pares:
        return None
    fig, ax = plt.subplots(figsize=(9, 3.8))
    xs = [mdates.date2num(d) for d, _ in pares]
    ys = [v for _, v in pares]
    if barras:
        ax.bar(xs, ys, color=color, width=0.7)
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


__all__ = ["barras_diarias", "serie_horaria", "ica_categorias", "meteo_diaria", "nombre_archivo", "date"]
