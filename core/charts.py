"""Generacion de graficas de resultados (nivel resultante +/- incertidumbre
vs. estandar maximo permisible), equivalentes a la hoja 'Graficas Resultados'
de la matriz de procesamiento manual.
"""
from __future__ import annotations

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

COLOR_BARRA = "#2E75B6"
COLOR_LIMITE = "#C00000"


def _grafica_jornada(nombres, niveles, incertidumbres, limites, titulo, ylabel, ruta_salida):
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    x = range(len(nombres))
    ax.bar(x, niveles, yerr=incertidumbres, capsize=4, color=COLOR_BARRA,
           label="Nivel de presion sonora resultante", zorder=3)

    # Linea de estandar (puede variar por punto si tienen sectores distintos).
    for i, lim in enumerate(limites):
        if lim is None:
            continue
        ax.plot([i - 0.4, i + 0.4], [lim, lim], color=COLOR_LIMITE, linewidth=2, zorder=4)
    if any(l is not None for l in limites):
        ax.plot([], [], color=COLOR_LIMITE, linewidth=2, label="Estandar maximo permisible")

    ax.set_xticks(list(x))
    ax.set_xticklabels(nombres, rotation=0)
    ax.set_ylabel(ylabel)
    ax.set_title(titulo)
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(axis="y", linestyle="--", alpha=0.4, zorder=0)
    fig.tight_layout()
    fig.savefig(ruta_salida)
    plt.close(fig)
    return ruta_salida


def generar_graficas(resultados_proyecto, carpeta_salida: str) -> dict:
    """Genera las graficas diurna y nocturna del proyecto.

    Devuelve un dict {"diurno": ruta_png|None, "nocturno": ruta_png|None}.
    """
    os.makedirs(carpeta_salida, exist_ok=True)
    comparacion = resultados_proyecto.comparacion

    nombres = []
    dia_niveles, dia_incert, dia_limites = [], [], []
    noche_niveles, noche_incert, noche_limites = [], [], []

    for no_punto, rc in comparacion.items():
        nombres.append(rc.punto.nombre)
        nivel_dia = rc.lraeq_dh if rc.lraeq_dh is not None else rc.lraeq_dnh
        nivel_noche = rc.lraeq_ndh if rc.lraeq_ndh is not None else rc.lraeq_ndnh
        dia_niveles.append(nivel_dia if nivel_dia is not None else 0)
        noche_niveles.append(nivel_noche if nivel_noche is not None else 0)
        dia_incert.append(rc.punto.incertidumbre or 0)
        noche_incert.append(rc.punto.incertidumbre or 0)
        dia_limites.append(rc.estandar_diurno)
        noche_limites.append(rc.estandar_nocturno)

    rutas = {"diurno": None, "nocturno": None}
    if nombres and any(v for v in dia_niveles):
        rutas["diurno"] = _grafica_jornada(
            nombres, dia_niveles, dia_incert, dia_limites,
            "Resultados de monitoreo - Jornada diurna", "LRAeq,1h dB(A)",
            os.path.join(carpeta_salida, "grafica_diurna.png"),
        )
    if nombres and any(v for v in noche_niveles):
        rutas["nocturno"] = _grafica_jornada(
            nombres, noche_niveles, noche_incert, noche_limites,
            "Resultados de monitoreo - Jornada nocturna", "LRAeq,1h dB(A)",
            os.path.join(carpeta_salida, "grafica_nocturna.png"),
        )
    return rutas


def generar_espectro(detalle_tonal: dict, titulo: str, ruta_salida: str) -> str:
    """Grafica el espectro en tercios de octava (Leq vs. suavizado) de una
    direccion/medicion puntual, util como anexo de soporte del ajuste tonal."""
    bandas = list(detalle_tonal.keys())
    leq = [detalle_tonal[b][0] for b in bandas]
    ls = [detalle_tonal[b][1] for b in bandas]

    fig, ax = plt.subplots(figsize=(9, 4), dpi=150)
    x = range(len(bandas))
    ax.plot(x, leq, marker="o", markersize=3, color=COLOR_BARRA, label="Leq por banda")
    ax.plot(x, ls, marker="o", markersize=3, color="#999999", linestyle="--", label="Espectro suavizado (Ls)")
    ax.set_xticks(list(x))
    ax.set_xticklabels(bandas, rotation=90, fontsize=6)
    ax.set_xlabel("Frecuencia (Hz)")
    ax.set_ylabel("Nivel (dB)")
    ax.set_title(titulo)
    ax.legend(fontsize=8)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    fig.tight_layout()
    fig.savefig(ruta_salida)
    plt.close(fig)
    return ruta_salida
