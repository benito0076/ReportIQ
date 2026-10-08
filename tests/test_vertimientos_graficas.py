import os
import tempfile
import unittest

from core.vertimientos_graficas import in_situ

class TestVertimientosGraficas(unittest.TestCase):
    def test_in_situ_empty_and_none(self):
        # Test with empty data
        self.assertIsNone(in_situ([], [], "pH", "ruta.png"))

        # Test with only None values
        self.assertIsNone(in_situ(["10:00", "11:00"], [None, None], "pH", "ruta.png"))

    def test_in_situ_happy_path(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, "grafica_insitu.png")
            horas = ["08:00", "09:00", "10:00"]
            valores = [7.1, 7.5, None] # One None to test filtering
            limites = [("Min", 6.0), ("Max", 9.0)]
            bajos = [False, True, False]

            res = in_situ(horas, valores, "pH (Unidades)", ruta, limites=limites, bajos=bajos)

            # Should return the path
            self.assertEqual(res, ruta)
            # File should exist
            self.assertTrue(os.path.exists(ruta))
            # Check size > 0
            self.assertGreater(os.path.getsize(ruta), 0)

if __name__ == "__main__":
    unittest.main()
