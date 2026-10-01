"""Calidad del aire: lectura de las plantillas FP y calculos (Res. 2254 de 2017)."""
import os
import sys
import tempfile
import unittest
from datetime import date

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from core.aire import (  # noqa: E402
    CO, COV, NO2, PM10, PM25, SO2, ErrorPlantillaAire, ProyectoAire, estadistica, ica, leer_pm10_hivol,
    percentil_exc, procesar_aire, redondear,
)
from core.meteorologia import _norm  # noqa: E402
from tests import plantillas_aire as fp  # noqa: E402

# Datos horarios reales de CO (ppm) de Finca Los Camachos, 08 y 09/02/2026.
CO_HORAS = [1.62, 1.26, 1.95, 1.39, 1.3, 1.56, 2.67, 2.5, 2.69, 2.47, 1.02, 2.4, 1.44, 2.16, 1.25, 1.16, 2.19,
            2.15, 2.64, 2.82, 2.36, 1.9, 1.04, 1.84, 1.1, 0.9, 1.65, 1.5, 1.87, 1.35, 2.26, 1.68, 2.62, 1.72, 0.99,
            1.84, 1.0, 1.44, 1.95, 1.0, 0.83, 2.74, 1.41, 2.06, 1.49, 1.74, 2.57, 0.18]
NO2_HORAS = [0.8, 1.2, 1.49, 0.9] * 6


class TestCalculos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        rutas = {k: os.path.join(cls.tmp.name, f"{k}.xlsx") for k in ("pm10", "pm25", "so2", "cov", "auto")}
        fp.fp031_pm10(rutas["pm10"])
        fp.fp032_pm25(rutas["pm25"])
        fp.fp033_so2(rutas["so2"])
        fp.fp035_cov(rutas["cov"])
        fp.fp021_automaticos(rutas["auto"], CO_HORAS, NO2_HORAS)
        cls.rutas = rutas
        cls.res = procesar_aire(ProyectoAire(plantillas={
            PM10: rutas["pm10"], PM25: rutas["pm25"], SO2: rutas["so2"], COV: rutas["cov"], "AUTOMATICOS": rutas["auto"],
        }))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_pm10_hivol_como_el_informe(self):
        s = self.res.manuales[(PM10, 1)]
        self.assertEqual([m.fecha for m in s.muestras], [date(2026, 2, 8), date(2026, 2, 9)])
        self.assertEqual([round(m.concentracion, 2) for m in s.muestras], [48.92, 51.39])
        self.assertAlmostEqual(s.muestras[0].volumen, 977.99, places=2)
        self.assertTrue(all(m.valida for m in s.muestras))

    def test_pm25_con_temperatura_ambiente(self):
        m = self.res.manuales[(PM25, 1)].muestras[0]
        # La FP-032 V03 usaba el caudal en lugar de la temperatura (16,26 µg/m3).
        self.assertAlmostEqual(m.concentracion, 16.93, places=2)
        self.assertAlmostEqual(m.minutos, 1430)

    def test_so2_y_cov_bajo_el_limite_de_cuantificacion(self):
        so2 = self.res.manuales[(SO2, 1)]
        self.assertAlmostEqual(so2.muestras[0].concentracion, 9.36, places=2)
        self.assertTrue(so2.bajo_lc)
        self.assertAlmostEqual(self.res.cov[("Tolueno", 1)].muestras[0].concentracion, 7.679, places=3)
        self.assertAlmostEqual(self.res.cov[("m,p-Xileno", 1)].muestras[0].concentracion, 15.358, places=3)
        self.assertTrue(self.res.cov[("Tolueno", 1)].bajo_lc)

    def test_gases_maximo_horario_y_media_movil(self):
        dias = self.res.automaticos[(CO, 1)].dias
        self.assertEqual(round(dias[0].max_horario, 2), 3214.80)  # 2,82 ppm x 1.140
        self.assertEqual(round(dias[0].max_8h, 2), 2472.38)
        # La media movil del 09/02 toma horas del 08/02 (como la FP-021).
        self.assertEqual(redondear(dias[1].max_8h), 2258.63)
        no2 = self.res.automaticos[(NO2, 1)]
        self.assertEqual(round(no2.dias[0].max_horario, 2), 2.80)
        self.assertEqual(no2.nombre_estacion, "")
        self.assertEqual(self.res.automaticos[(CO, 1)].nombre_estacion, "Finca Los Camachos -Tempestuosa")

    def test_redondeo_como_excel(self):
        self.assertEqual(redondear(2258.6249999999995), 2258.63)
        self.assertEqual(redondear(0.125), 0.13)

    def test_ica_y_estaciones(self):
        self.assertEqual([round(v, 2) for v in ica(PM10, 48.92)[:1]], [44.48])
        self.assertEqual(ica(PM25, 16.93)[1], "Aceptable")
        self.assertIsNone(ica("O3", 400))
        dias = self.res.dias_ica(1)
        self.assertEqual(dias[CO][0][3], "Buena")
        self.assertEqual([e.nombre for e in self.res.estaciones()], ["Finca Los Camachos -Tempestuosa E1_Lis_Tmpst"])
        self.assertEqual(self.res.contaminantes(), [PM10, PM25, SO2, NO2, CO, COV])

    def test_plantilla_equivocada(self):
        with self.assertRaises(ErrorPlantillaAire):
            leer_pm10_hivol(self.rutas["pm25"])
        res = procesar_aire(ProyectoAire(plantillas={PM10: self.rutas["so2"]}))
        self.assertTrue(any("FP-031" in a for a in res.advertencias))


class TestEstadistica(unittest.TestCase):
    def test_cuartiles_como_excel(self):
        datos = [48.92, 51.39, 47.22, 47.80, 49.39, 45.31, 41.85, 28.44, 26.97, 27.45, 29.79, 23.83, 21.02, 21.40,
                 30.46, 23.53, 24.89, 26.53]
        e = estadistica([(date(2026, 2, i + 1), v) for i, v in enumerate(datos)])
        self.assertEqual((round(e.promedio, 2), round(e.desviacion, 2), round(e.mediana, 2)), (34.23, 11.24, 29.12))
        # Datos ya redondeados a 2 decimales: el informe (con todos los decimales) da 24,63 y 47,37.
        self.assertEqual((round(e.q1, 2), round(e.q3, 2)), (24.62, 47.36))
        self.assertEqual(e.atipicos, 0)
        self.assertEqual(percentil_exc([1, 2, 3, 4], 0.25), 1.25)


class TestMeteorologia(unittest.TestCase):
    def test_encabezados_con_tildes_danadas(self):
        self.assertEqual(_norm("PresiÃ³n absoluta(hpa)"), "presion absoluta(hpa)")
        self.assertEqual(_norm("DirecciÃ³n del viento(Â°)"), "direccion del viento()")


if __name__ == "__main__":
    unittest.main()
