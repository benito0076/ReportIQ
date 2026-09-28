"""Pruebas del lector de memorias con distintos formatos de exportacion de la
hoja 'Resumen' (SoundTrack LxT, SoundExpert 821 y variantes)."""
import os
import sys
import tempfile
import unittest
from datetime import datetime

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.models import ArchivoMemoria, DIRECCIONES, Proyecto  # noqa: E402
from core.pipeline import procesar_proyecto  # noqa: E402
from core.sonometer_reader import leer_memoria  # noqa: E402


def _guardar(filas, ruta):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumen"
    for fila in filas:
        ws.append(list(fila))
    wb.save(ruta)
    return ruta


class TestFormatosResumen(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def _ruta(self, nombre):
        return os.path.join(self.tmp.name, nombre)

    def test_formato_lxt_numerico(self):
        ruta = _guardar([
            ("Número de Serie", "0006599"), ("LAeq (dB)", 57.8), ("LAIeq (dB)", 60.5),
            ("LAS 90,0 (dB)", 50.1), ("LASmax (dB)", 70.2), ("LASmin (dB)", 45.3), ("LApk (dB)", 90.4),
        ], self._ruta("lxt.xlsx"))
        d = leer_memoria(ruta)
        self.assertEqual((d.laeq, d.laieq, d.l90, d.lmax, d.lmin, d.lpico), (57.8, 60.5, 50.1, 70.2, 45.3, 90.4))

    def test_numeros_como_texto_con_coma(self):
        ruta = _guardar([
            ("Medidor", "SoundExpert 821", "40034"), ("LAeq (dB)", "57,8"), ("LAIeq (dB)", "60,5 dB"),
            ("LAS 90,0 (dB)", "50,1"),
        ], self._ruta("texto.xlsx"))
        d = leer_memoria(ruta)
        self.assertEqual((d.laeq, d.laieq, d.l90), (57.8, 60.5, 50.1))
        self.assertEqual(d.numero_serie, "40034")

    def test_etiquetas_variantes_valor_en_otra_columna(self):
        ruta = _guardar([
            ("LAeq", "dB", 57.8), ("LAIeq", "dB", 60.5), ("LAF90", "dB", 50.1),
            ("LAFmax", "dB", 70.2), ("LAFmin", "dB", 45.3), ("LZpeak", "dB", 90.4),
            ("LCeq", "dB", 99.9),
        ], self._ruta("variantes.xlsx"))
        d = leer_memoria(ruta)
        self.assertEqual((d.laeq, d.laieq, d.l90, d.lmax, d.lmin, d.lpico), (57.8, 60.5, 50.1, 70.2, 45.3, 90.4))

    def test_formato_horizontal(self):
        ruta = _guardar([
            ("Resultados", None, None, None),
            ("Canal", "LAeq (dB)", "LAIeq (dB)", "LAS90 (dB)"),
            ("1", 57.8, 60.5, 50.1),
        ], self._ruta("horizontal.xlsx"))
        d = leer_memoria(ruta)
        self.assertEqual((d.laeq, d.laieq, d.l90), (57.8, 60.5, 50.1))

    def test_formato_desconocido_genera_advertencia_con_contenido(self):
        proyecto = Proyecto()
        punto = proyecto.agregar_punto("RA1")
        for d in DIRECCIONES:
            ruta = _guardar([("Tiempo de inicio", datetime(2025, 5, 2, 8, 0)), ("Nivel global", "57,8")],
                            self._ruta(f"raro_{d}.xlsx"))
            punto.archivos["DH"][d] = ArchivoMemoria(d, ruta)
        r = procesar_proyecto(proyecto)
        mensajes = [a.mensaje for a in r.advertencias]
        self.assertEqual(len(mensajes), 5)
        self.assertIn("No se encontro el LAeq", mensajes[0])
        self.assertIn("Nivel global | 57,8", mensajes[0])


if __name__ == "__main__":
    unittest.main()
