import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.geo import coordenadas_a_metros, parsear_coordenada


class TestGeo(unittest.TestCase):
    def test_detecta_origen_nacional_colombia(self):
        # Valores tipicos de Origen Nacional / UTM (varios cientos de miles a
        # millones): deben tratarse como metros, sin proyeccion geografica.
        pares = [(4919600, 2309950), (4921100, 2305650), (4918700, 2306050)]
        resultado, geografica = coordenadas_a_metros(pares)
        self.assertFalse(geografica)
        self.assertEqual(len(resultado), 3)
        # El centroide queda en el origen (0,0).
        cx = sum(p[0] for p in resultado) / 3
        cy = sum(p[1] for p in resultado) / 3
        self.assertAlmostEqual(cx, 0.0, places=6)
        self.assertAlmostEqual(cy, 0.0, places=6)

    def test_detecta_lat_long_colombia(self):
        # Longitud/latitud tipicas de Colombia (grados decimales, ambas < 180).
        pares = [(-73.12, 6.85), (-73.10, 6.87), (-73.13, 6.86)]
        resultado, geografica = coordenadas_a_metros(pares)
        self.assertTrue(geografica)
        # La separacion entre puntos debe quedar en el orden de cientos-miles
        # de metros (no en grados), consistente con ~0.02-0.03 grados.
        distancias = [abs(x) for x, y in resultado]
        self.assertTrue(any(d > 100 for d in distancias))
        self.assertTrue(all(d < 10000 for d in distancias))

    def test_parsear_coordenada_admite_coma_decimal(self):
        self.assertAlmostEqual(parsear_coordenada("4919600,5"), 4919600.5)
        self.assertIsNone(parsear_coordenada(""))
        self.assertIsNone(parsear_coordenada(None))
        self.assertIsNone(parsear_coordenada("no es un numero"))


if __name__ == "__main__":
    unittest.main()
