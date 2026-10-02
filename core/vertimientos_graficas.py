"""Graficas del informe de vertimientos (matplotlib, PNG).

    caudal(...)       caudal del aforo volumetrico a lo largo de la jornada (linea)
    in_situ(...)      parametro medido en campo por hora (barras), con los limites
    laboratorio(...)  resultado del laboratorio por punto (barras) frente a los limites
"""
from __future__ import annotations

import os
import re
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

PALETA = ["#2F5597", "#C55A11", "#548235", "#7030A0", "#BF9000", "#2E75B6", "#843C0C", "#3A3A3A"]
COLOR_LIMITES = ["#C00000", "#E46C0A", "#7F7F7F", "#00B050"]


def _num(v, _=None) -> str:
    if v == 0:
        return "0"
    if abs(v) >= 100:
        return f"{v:,.0f}".replace(",", ".")
    txt = f"{v:.4f}".rstrip("0").rstrip(".")
    return txt.replace(".", ",")


_FMT = FuncFormatter(_num)


def _fijo(v, dec: int) -> str:
    return f"{v:,.{dec}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _leyenda(ax, n_items: int, extra=None):
    handles, labels = ax.get_legend_handles_labels()
    if extra:
        handles.append(extra[0])
        labels.append(extra[1])
    largas = any(len(l) > 40 for l in labels)
    ax.legend(handles, labels, loc="upper center", bbox_to_anchor=(0.5, -0.28), ncol=1 if largas else min(3, n_items),
              frameon=False, fontsize=8)


def _guardar(fig, ruta):
    fig.tight_layout()
    fig.savefig(ruta, dpi=150)
    plt.close(fig)
    return ruta


def nombre_archivo(carpeta: str, *partes) -> str:
    base = "_".join(re.sub(r"[^\w]+", "_", str(p)).strip("_").lower() for p in partes if p)
    return os.path.join(carpeta, f"vert_{base[:80]}.png")


def caudal(horas: list[str], valores: list[Optional[float]], ruta: str, unidad: str = "mL/s", decimales: int = 1):
    pares = [(h, v) for h, v in zip(horas, valores) if v is not None]
    if not pares:
        return None
    fig, ax = plt.subplots(figsize=(9, 4))
    xs = list(range(len(pares)))
    ax.plot(xs, [v for _, v in pares], marker="o", color=PALETA[0], linewidth=2, label="Caudal")
    for x, (_, v) in zip(xs, pares):
        ax.annotate(_fijo(v, decimales), (x, v), textcoords="offset points", xytext=(0, 6), ha="center", fontsize=7)
    ax.set_xticks(xs, [h for h, _ in pares], rotation=90)
    ax.set_xlabel("Hora")
    ax.set_ylabel(f"Caudal ({unidad})")
    ax.yaxis.set_major_formatter(_FMT)
    alto = max(v for _, v in pares)
    ax.set_ylim(0, alto * 1.2 if alto > 0 else 1)
    ax.grid(axis="y", alpha=0.3)
    _leyenda(ax, 1)
    return _guardar(fig, ruta)


def in_situ(horas: list[str], valores: list[Optional[float]], titulo_y: str, ruta: str,
            limites: Optional[list[tuple[str, float]]] = None, color: str = PALETA[0], decimales: int = 2,
            bajos: Optional[list[bool]] = None, etiqueta: str = ""):
    """Barras por hora con lineas horizontales de los limites (p. ej. pH 6 y 9). `bajos`: valores "<LCM"
    (barra rayada con el LCM)."""
    bajos = bajos or [False] * len(valores)
    datos = [(h, v, b) for h, v, b in zip(horas, valores, bajos) if v is not None]
    if not datos:
        return None
    fig, ax = plt.subplots(figsize=(9, 4))
    xs = list(range(len(datos)))
    tope = 0.0
    for x, (_, v, b) in zip(xs, datos):
        ax.bar(x, v, width=0.6, color="white" if b else color, edgecolor=color, hatch="///" if b else None)
        ax.annotate(("<" if b else "") + _fijo(v, decimales), (x, v), textcoords="offset points", xytext=(0, 3),
                    ha="center", fontsize=7)
        tope = max(tope, v)
    ax.bar([], [], color=color, label=etiqueta or titulo_y.split(" (")[0])  # muestra de la leyenda
    for k, (texto, valor) in enumerate(limites or []):
        ax.axhline(valor, color=COLOR_LIMITES[k % len(COLOR_LIMITES)], linewidth=1.8, linestyle="--", label=texto)
        tope = max(tope, valor)
    ax.set_xticks(xs, [h for h, _, _ in datos], rotation=90)
    ax.set_xlabel("Hora")
    ax.set_ylabel(titulo_y)
    ax.yaxis.set_major_formatter(_FMT)
    ax.set_ylim(0, tope * 1.15 if tope > 0 else 1)
    ax.grid(axis="y", alpha=0.3)
    extra = (Patch(facecolor="white", edgecolor="#555555", hatch="///"), "Inferior al LCM (se grafica el LCM)") \
        if any(b for _, _, b in datos) else None
    _leyenda(ax, 1 + len(limites or []), extra)
    return _guardar(fig, ruta)


def laboratorio(series: list[tuple[str, list[Optional[float]], list[bool]]], puntos: list[str], unidad: str,
                ruta: str, limites: Optional[list[tuple[str, float]]] = None):
    """`series`: [(parametro, valor por punto, menor que LCM por punto)]. Las barras de un resultado
    "<LCM" se dibujan con el LCM y rayadas. `limites`: [(etiqueta, valor)] lineas horizontales."""
    if not any(v is not None for _, valores, _ in series for v in valores):
        return None
    fig, ax = plt.subplots(figsize=(9, 4.2))
    n = max(len(series), 1)
    ancho = 0.75 / n
    tope = 0.0
    hay_lcm = False
    for k, (nombre, valores, bajo) in enumerate(series):
        color = PALETA[k % len(PALETA)]
        for i, (v, menor) in enumerate(zip(valores, bajo)):
            if v is None:
                continue
            x = i + (k - (n - 1) / 2) * ancho
            ax.bar(x, v, width=ancho * 0.92, color="white" if menor else color, edgecolor=color,
                   hatch="///" if menor else None, linewidth=1.2, label=nombre if i == 0 else None)
            ax.annotate(("<" if menor else "") + _num(v), (x, v), textcoords="offset points", xytext=(0, 3),
                        ha="center", fontsize=7)
            tope = max(tope, v)
            hay_lcm = hay_lcm or menor
    for k, (etiqueta, valor) in enumerate(limites or []):
        ax.axhline(valor, color=COLOR_LIMITES[k % len(COLOR_LIMITES)], linewidth=1.8, linestyle="--", label=etiqueta)
        tope = max(tope, valor)
    ax.set_xticks(range(len(puntos)), puntos)
    ax.set_ylabel(unidad)
    ax.yaxis.set_major_formatter(_FMT)
    ax.set_ylim(0, tope * 1.18 if tope > 0 else 1)
    ax.grid(axis="y", alpha=0.3)
    extra = (Patch(facecolor="white", edgecolor="#555555", hatch="///"), "Inferior al LCM (se grafica el LCM)") \
        if hay_lcm else None
    _leyenda(ax, len(series) + len(limites or []), extra)
    return _guardar(fig, ruta)
