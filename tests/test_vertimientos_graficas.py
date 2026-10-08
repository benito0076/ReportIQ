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

if __name__ == "__main__":
    unittest.main()
