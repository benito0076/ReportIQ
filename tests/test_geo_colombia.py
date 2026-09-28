import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.geo_colombia import (
    geografica_a_origen_nacional,
    geograficas_desde_origen_nacional,
    origen_nacional_a_geografica,
    origen_nacional_a_web_mercator,
    web_mercator_a_geografica,
)

# Datos reales del proyecto ER-731-26 (Tabla 3 del informe), usados como
# control de calidad exacto de la conversion Origen Nacional -> geografica.
CASOS = [
    ("RA34", 4919855.125, 2309786.167, "73°43'32.11\"O", "6°48'11.00\"N"),
    ("RA51", 4921029.181, 2305271.928, "73°42'53.63\"O", "6°45'44.00\"N"),
    ("RA54", 4919539.506, 2308027.992, "73°43'42.31\"O", "6°47'13.71\"N"),
    ("RA55", 4919671.819, 2308273.678, "73°43'38.01\"O", "6°47'21.72\"N"),
    ("RA56", 4919683.486, 2306230.142, "73°43'37.53\"O", "6°46'15.15\"N"),
]


class TestGeoColombia(unittest.TestCase):
    def test_conversion_exacta_puntos_reales(self):
        for nombre, este, norte, lon_esperado, lat_esperado in CASOS:
            lon_dms, lat_dms, _, _ = geograficas_desde_origen_nacional(este, norte)
            self.assertEqual(lon_dms, lon_esperado, msg=f"{nombre}: longitud no coincide")
            self.assertEqual(lat_dms, lat_esperado, msg=f"{nombre}: latitud no coincide")

    def test_proyeccion_directa_es_inversa_de_la_inversa(self):
        for nombre, este, norte, _, _ in CASOS:
            lat, lon = origen_nacional_a_geografica(este, norte)
            este2, norte2 = geografica_a_origen_nacional(lat, lon)
            self.assertAlmostEqual(este, este2, delta=0.01, msg=f"{nombre}: Este no coincide en redondeo")
            self.assertAlmostEqual(norte, norte2, delta=0.01, msg=f"{nombre}: Norte no coincide en redondeo")

    def test_web_mercator_redondeo(self):
        for nombre, este, norte, _, _ in CASOS:
            x, y = origen_nacional_a_web_mercator(este, norte)
            lat, lon = web_mercator_a_geografica(x, y)
            este2, norte2 = geografica_a_origen_nacional(lat, lon)
            self.assertAlmostEqual(este, este2, delta=0.01, msg=f"{nombre}: Este no coincide (via Web Mercator)")
            self.assertAlmostEqual(norte, norte2, delta=0.01, msg=f"{nombre}: Norte no coincide (via Web Mercator)")


if __name__ == "__main__":
    unittest.main()
