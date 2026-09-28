"""Exporta los resultados procesados a un libro de Excel con la misma
estructura de la matriz de procesamiento manual (una hoja por esquema
DH/DNH/NDH/NDNH + hoja de Comparacion con la norma)."""
from __future__ import annotations

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

from .models import DIRECCIONES, ESQUEMA_LABELS

_HEADER_FILL = PatternFill("solid", fgColor="D9E1F2")
_HEADER_FONT = Font(bold=True)

_COLUMNAS = [
    ("No. Punto", 10), ("Punto de Monitoreo", 24), ("Direccion", 10),
    ("Inicio", 18), ("Fin", 18),
    ("Lpico dB(A)", 12), ("Lmax dB(A)", 12), ("Lmin dB(A)", 12),
    ("L90 dB(A)", 12), ("LAeq dB(A)", 12), ("LAIeq dB(A)", 12),
    ("Li dB(A)", 10), ("KI", 8), ("KT", 8), ("KS", 8),
    ("Correccion pantalla", 12), ("Correccion", 12),
    ("L90 Corregido", 14), ("LRAeq Corregido", 16), ("Tipo de ajuste", 30),
]


def _fmt(v, nd=1):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return round(v, nd)
    return v


def _escribir_hoja_esquema(wb, esquema, resultados_proyecto):
    ws = wb.create_sheet(esquema)
    ws.append([c[0] for c in _COLUMNAS])
    for cell, (_, ancho) in zip(ws[1], _COLUMNAS):
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
    for i, (_, ancho) in enumerate(_COLUMNAS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = ancho

    for punto in resultados_proyecto.proyecto.puntos:
        rp = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema)
        if rp is None:
            continue
        for direccion in DIRECCIONES:
            rd = rp.direcciones.get(direccion)
            if rd is None:
                continue
            ws.append([
                punto.no_punto, punto.nombre, direccion,
                str(rd.inicio) if rd.inicio else None,
                str(rd.fin) if rd.fin else None,
                _fmt(rd.lpico), _fmt(rd.lmax), _fmt(rd.lmin),
                _fmt(rd.l90), _fmt(rd.laeq), _fmt(rd.laieq),
                _fmt(rd.li), _fmt(rd.ki, 0), _fmt(rd.kt, 0), _fmt(rd.ks, 0),
                _fmt(rd.correccion_pantalla, 0), _fmt(rd.correccion, 0),
                _fmt(rd.l90_corregido), _fmt(rd.lraeq_corregido), rd.tipo_ajuste,
            ])
        # Fila de nivel resultante del punto para este esquema.
        ws.append([
            punto.no_punto, punto.nombre, "RESULTANTE (prom. energetico)",
            str(rp.inicio) if rp.inicio else None, str(rp.fin) if rp.fin else None,
            None, None, None, None, None, None, None, None, None, None, None, None,
            None, _fmt(rp.lraeq_resultante), None,
        ])
    return ws


def _escribir_hoja_comparacion(wb, resultados_proyecto):
    ws = wb.create_sheet("Comparacion Norma")
    encabezados = [
        "No. Punto", "Punto de Monitoreo", "Sector",
        "LRAeq,1h - Dia Habil", "LRAeq,1h - Dia No Habil",
        "Estandar Diurno dB(A)", "Cumple Diurno (DH)", "Cumple Diurno (DNH)",
        "LRAeq,1h - Nocturno Habil", "LRAeq,1h - Nocturno No Habil",
        "Estandar Nocturno dB(A)", "Cumple Nocturno (NDH)", "Cumple Nocturno (NDNH)",
    ]
    ws.append(encabezados)
    for cell in ws[1]:
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
    anchos = [10, 24, 45, 14, 16, 14, 12, 12, 16, 18, 14, 12, 12]
    for i, a in enumerate(anchos, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = a

    for no_punto, rc in resultados_proyecto.comparacion.items():
        ws.append([
            no_punto, rc.punto.nombre, rc.punto.sector,
            _fmt(rc.lraeq_dh), _fmt(rc.lraeq_dnh),
            _fmt(rc.estandar_diurno, 0), rc.cumple_dh, rc.cumple_dnh,
            _fmt(rc.lraeq_ndh), _fmt(rc.lraeq_ndnh),
            _fmt(rc.estandar_nocturno, 0), rc.cumple_ndh, rc.cumple_ndnh,
        ])
    return ws


def _escribir_hoja_advertencias(wb, resultados_proyecto):
    if not resultados_proyecto.advertencias:
        return
    ws = wb.create_sheet("Advertencias")
    ws.append(["Punto", "Esquema", "Direccion", "Mensaje"])
    for cell in ws[1]:
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
    for a in resultados_proyecto.advertencias:
        ws.append([a.punto, a.esquema, a.direccion, a.mensaje])
    ws.column_dimensions["D"].width = 80


def exportar_resultados(resultados_proyecto, ruta_salida: str):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    for esquema, etiqueta in ESQUEMA_LABELS.items():
        tiene_datos = any(
            esquema in resultados_proyecto.por_punto.get(p.no_punto, {})
            for p in resultados_proyecto.proyecto.puntos
        )
        if tiene_datos:
            _escribir_hoja_esquema(wb, esquema, resultados_proyecto)

    _escribir_hoja_comparacion(wb, resultados_proyecto)
    _escribir_hoja_advertencias(wb, resultados_proyecto)

    wb.save(ruta_salida)
    return ruta_salida
