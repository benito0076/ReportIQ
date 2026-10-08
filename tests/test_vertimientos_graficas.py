import os
import unittest
from core.vertimientos_graficas import nombre_archivo

class TestNombreArchivo(unittest.TestCase):
    def test_basic_joining(self):
        result = nombre_archivo("folder", "Part1", "Part2")
        self.assertEqual(result, os.path.join("folder", "vert_part1_part2.png"))

    def test_special_characters(self):
        result = nombre_archivo("dir", "Hello World!", "Test@123")
        self.assertEqual(result, os.path.join("dir", "vert_hello_world_test_123.png"))

    def test_empty_and_falsy_parts(self):
        result = nombre_archivo("output", "a", "", None, "b")
        self.assertEqual(result, os.path.join("output", "vert_a_b.png"))

    def test_truncation(self):
        long_part1 = "a" * 50
        long_part2 = "b" * 50
        result = nombre_archivo("tmp", long_part1, long_part2)
        # Expected base length is 80
        expected_base = (long_part1 + "_" + long_part2)[:80]
        self.assertEqual(result, os.path.join("tmp", f"vert_{expected_base}.png"))

    def test_strip_underscores(self):
        result = nombre_archivo("res", "__start", "end__")
        self.assertEqual(result, os.path.join("res", "vert_start_end.png"))

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
