"""Pruebas del capitulo de meteorologia: lectura del archivo de la estacion,
filtro por dias de medicion, resumenes, rosa de vientos y textos."""
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.meteorologia import analizar, filas_tabla_diaria, leer_datos_meteorologicos  # noqa: E402

ENCABEZADO = ["Date & Time", "Barometer - mm Hg", "Temp - °C", "High Temp - °C", "Low Temp - °C", "Hum - %",
              "Wind Speed - m/s", "Wind Direction", "High Wind Speed - m/s", "Rain - mm", "Rain Rate - mm/h"]


def crear_archivo(ruta, dias=(date(2026, 3, 10), date(2026, 3, 11)), bloque_desplazado=True):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(ENCABEZADO)
    for k, d in enumerate(dias):
        for h in range(24):
            f = datetime(d.year, d.month, d.day, h)
            viento = 0.0 if h < 6 else (1.0 if h < 20 else 2.0)
            direccion = None if viento == 0 else ("WSW" if h % 2 else "OSO")  # OSO = WSW en espanol
            lluvia = 1.5 if (k == 1 and h == 3) else 0
            ws.append([f, 750 + k, 25 + k * 2 + (h > 12), 26, 24, 80 - k * 10, viento, direccion, 3, lluvia, 0])
    if bloque_desplazado:
        # Otro formato pegado sin encabezado: valores imposibles en Temp/Hum.
        f0 = datetime(dias[-1].year, dias[-1].month, dias[-1].day) + timedelta(days=1)
        for h in range(5):
            ws.append([f0 + timedelta(hours=h), 759.5, 759.5, 759.5, 750.4, 26.3, 0.1, 0.1, -55.3, -35.7, 0])
    wb.save(ruta)
    return ruta


class TestMeteorologia(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ruta = crear_archivo(os.path.join(self.tmp.name, "meteo.xlsx"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_formato_estacion_ecowitt(self):
        """Exportacion tipo EasyWeather/Ecowitt: 'Time', 'Outdoor Temperature(℃)', 'Wind(m/s)',
        direccion en grados, 'ABS Pressure(mmhg)' y 'Hourly Rain(mm)' (se suma por registro)."""
        ruta = os.path.join(self.tmp.name, "ecowitt.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Time", "Indoor Temperature(℃)", "Outdoor Temperature(â„ƒ)", "Outdoor Humidity(%)", "Wind(m/s)",
                   "Wind Direction(Â°)", "ABS Pressure(mmhg)", "Hourly Rain(mm)", None])
        for k, lluvia in enumerate((0, 0.2, 1.1, 0)):
            ws.append([datetime(2025, 12, 16, 5) + timedelta(minutes=30 * k), 30, 28.0, 82, 0.6, 250, 749.5, lluvia, None])
        wb.save(ruta)
        registros, advertencias = leer_datos_meteorologicos(ruta)
        self.assertEqual(advertencias, [])
        self.assertEqual(len(registros), 4)
        r = registros[1]
        self.assertEqual((r.temperatura, r.humedad, r.viento, r.direccion, r.presion), (28.0, 82.0, 0.6, "WSW", 749.5))
        analisis = analizar(registros, {date(2025, 12, 16)}, [])
        self.assertAlmostEqual(analisis.dias[0].lluvia, 1.3)

    def test_lectura_descarta_filas_desplazadas(self):
        registros, advertencias = leer_datos_meteorologicos(self.ruta)
        self.assertEqual(len(registros), 48)
        self.assertEqual(len(advertencias), 1)
        self.assertIn("se descartaron 5 fila(s)", advertencias[0])

    def test_solo_dias_de_medicion(self):
        registros, _ = leer_datos_meteorologicos(self.ruta)
        a = analizar(registros, {date(2026, 3, 11)}, [])
        self.assertEqual([d.dia for d in a.dias], [date(2026, 3, 11)])
        self.assertEqual(len(a.registros), 24)
        self.assertIsNone(analizar(registros, {date(2027, 1, 1)}, []))

    def test_resumen_diario_y_tabla(self):
        registros, _ = leer_datos_meteorologicos(self.ruta)
        a = analizar(registros, {date(2026, 3, 10), date(2026, 3, 11)}, [])
        d1, d2 = a.dias
        self.assertAlmostEqual(d1.temperatura, 25 + 11 / 24)
        self.assertAlmostEqual(d2.humedad, 70)
        self.assertEqual((d1.lluvia, d2.lluvia), (0, 1.5))
        filas = filas_tabla_diaria(a)
        self.assertEqual([f[0] for f in filas], ["2026-03-10", "2026-03-11", "Promedio", "Máximo", "Mínimo"])
        self.assertEqual(filas[1][4], "1,50")

    def test_rosa_de_vientos(self):
        registros, _ = leer_datos_meteorologicos(self.ruta)
        a = analizar(registros, {date(2026, 3, 10)}, [])
        # 6 h de calma de 24; el resto WSW (con 'OSO' en espanol normalizado a WSW).
        self.assertAlmostEqual(a.calmas_pct, 25.0)
        self.assertAlmostEqual(sum(a.frecuencias["WSW"]), 75.0)
        self.assertAlmostEqual(a.clases_pct[0], 100 * 14 / 24)  # 1 m/s -> clase 0,30-1,60
        self.assertAlmostEqual(a.clases_pct[1], 100 * 4 / 24)  # 2 m/s -> clase 1,60-3,40
        self.assertIn("OesteSurOeste (WSW)", a.textos["viento"])
        self.assertIn("25,00% corresponde a calmas", a.textos["viento"])

    def test_lluvia_durante_mediciones(self):
        registros, _ = leer_datos_meteorologicos(self.ruta)
        dias = {date(2026, 3, 11)}
        sin = analizar(registros, dias, [(datetime(2026, 3, 11, 9), datetime(2026, 3, 11, 9, 15))])
        self.assertEqual(sin.lluvia_en_mediciones, 0)
        self.assertIn("no se registró precipitación durante los intervalos", sin.textos["precipitacion"])
        con = analizar(registros, dias, [(datetime(2026, 3, 11, 3), datetime(2026, 3, 11, 3, 15))])
        self.assertEqual(con.lluvia_en_mediciones, 1.5)
        self.assertTrue(any("lluvia durante los intervalos" in a for a in con.advertencias))

    def test_textos_varios_dias(self):
        registros, _ = leer_datos_meteorologicos(self.ruta)
        a = analizar(registros, {date(2026, 3, 10), date(2026, 3, 11)}, [])
        self.assertIn("la temperatura promedio fue de", a.textos["temperatura"])
        self.assertIn("11 de marzo de 2026", a.textos["temperatura"])
        self.assertIn("puntos porcentuales", a.textos["humedad"])
        self.assertIn("relativamente estable", a.textos["presion"])


if __name__ == "__main__":
    unittest.main()
