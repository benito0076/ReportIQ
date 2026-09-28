"""Pruebas de regresion del motor de calculo (Res. 0627), verificadas contra
los valores del caso real RA1 (proyecto ER-731-26) y contra la matriz de
procesamiento manual de referencia."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import norms
from core.corrections import correccion_impulsividad, correccion_tonal, promedio_energetico


class TestCorreccionImpulsividad(unittest.TestCase):
    def test_sin_ajuste(self):
        li, ki = correccion_impulsividad(laeq=57.8, laieq=60.5)
        self.assertAlmostEqual(li, 2.7, places=3)
        self.assertEqual(ki, 0)

    def test_ajuste_3db(self):
        li, ki = correccion_impulsividad(laeq=59.2, laieq=62.4)
        self.assertAlmostEqual(li, 3.2, places=3)
        self.assertEqual(ki, 3)

    def test_ajuste_6db(self):
        li, ki = correccion_impulsividad(laeq=59.5, laieq=66.4)
        self.assertAlmostEqual(li, 6.9, places=3)
        self.assertEqual(ki, 6)

    def test_limite_exacto_3_no_ajusta(self):
        # La formula original usa M>3 (estricto), no M>=3.
        _, ki = correccion_impulsividad(laeq=50.0, laieq=53.0)
        self.assertEqual(ki, 0)

    def test_valores_faltantes(self):
        li, ki = correccion_impulsividad(None, 55.0)
        self.assertIsNone(li)
        self.assertIsNone(ki)


class TestCorreccionTonal(unittest.TestCase):
    def test_espectro_plano_sin_tono(self):
        espectro = {b: 40.0 for b in [
            "6,3", "8,0", "10,0", "12,5", "16,0", "20,0", "25,0", "31,5", "40,0", "50,0",
            "63,0", "80,0", "100", "125", "160", "200", "250", "315", "400", "500",
            "630", "800", "1000", "1250", "1600", "2000", "2500", "3150", "4000", "5000",
            "6300", "8000", "10000", "12500", "16000", "20000",
        ]}
        resultado = correccion_tonal(espectro)
        self.assertEqual(resultado.kt, 0)

    def test_tono_marcado_en_alta_frecuencia(self):
        bandas = [
            "6,3", "8,0", "10,0", "12,5", "16,0", "20,0", "25,0", "31,5", "40,0", "50,0",
            "63,0", "80,0", "100", "125", "160", "200", "250", "315", "400", "500",
            "630", "800", "1000", "1250", "1600", "2000", "2500", "3150", "4000", "5000",
            "6300", "8000", "10000", "12500", "16000", "20000",
        ]
        espectro = {b: 40.0 for b in bandas}
        espectro["1000"] = 55.0  # pico marcado de 15 dB sobre el promedio de vecinos (a partir de 500Hz, umbral 3-5dB)
        resultado = correccion_tonal(espectro)
        self.assertEqual(resultado.kt, 6)


class TestPromedioEnergetico(unittest.TestCase):
    def test_niveles_iguales(self):
        self.assertAlmostEqual(promedio_energetico([60, 60, 60, 60, 60]), 60.0, places=3)

    def test_caso_real_ra1_dh(self):
        # Valores LRAeq corregidos por direccion del caso RA1 (Diurno Dia Habil).
        niveles = [65.5, 62.2, 65.2, 57.8, 66.4]  # Vertical, Norte, Sur, Este, Oeste
        self.assertAlmostEqual(promedio_energetico(niveles), 64.31, places=1)


class TestNormas(unittest.TestCase):
    def test_estandares_sector_d_rural(self):
        etiqueta = "D - Zona suburbana o rural de tranquilidad y ruido moderado - Rural Habitada destinada a explotacion agropecuaria."
        self.assertEqual(norms.estandar_diurno(etiqueta), 55)
        self.assertEqual(norms.estandar_nocturno(etiqueta), 45)

    def test_cumple_estricto(self):
        self.assertEqual(norms.cumple(55, 55), "No")  # empate no cumple
        self.assertEqual(norms.cumple(54.9, 55), "Si")
        self.assertEqual(norms.cumple(64.3, 55), "No")


if __name__ == "__main__":
    unittest.main()
