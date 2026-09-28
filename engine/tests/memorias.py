"""Genera memorias de sonometro sinteticas (.xlsx) con las hojas 'Resumen' y
'OBA' en el formato exportado por el Larson Davis SoundTrack LxT."""
from __future__ import annotations

from datetime import datetime, timedelta

import openpyxl

from core.sonometer_reader import BANDAS_TERCIO_OCTAVA


def crear_memoria(ruta: str, laeq: float, laieq: float, serial: str = "0006599",
                  inicio: datetime = datetime(2026, 3, 10, 9, 0), espectro_plano: float = 40.0):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumen"
    ws.append(["Número de Serie", serial])
    ws.append(["Modelo", "SoundTrack LxT1"])
    ws.append(["Tiempo de inicio", inicio])
    ws.append(["Para el tiempo", inicio + timedelta(minutes=15)])
    ws.append(["LApk (dB)", laeq + 30])
    ws.append(["LASmax (dB)", laeq + 12])
    ws.append(["LASmin (dB)", laeq - 10])
    ws.append(["LAS 90,0 (dB)", laeq - 6])
    ws.append(["LAeq (dB)", laeq])
    ws.append(["LAIeq (dB)", laieq])
    oba = wb.create_sheet("OBA")
    oba.append(["Frecuencia (Hz)", *BANDAS_TERCIO_OCTAVA])
    oba.append(["1/3 LAeq", *[espectro_plano for _ in BANDAS_TERCIO_OCTAVA]])
    wb.save(ruta)
    return ruta
