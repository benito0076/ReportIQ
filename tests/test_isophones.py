import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.isophones import puntos_con_coordenadas
from core.models import Proyecto

class TestPuntosConCoordenadas(unittest.TestCase):
    def test_puntos_con_coordenadas(self):
        proyecto = Proyecto(nombre_proyecto="Prueba", cliente="Cliente")

        # 1. Point with valid integer coordinates
        p1 = proyecto.agregar_punto("P1")
        p1.longitud = "4955736"
        p1.latitud = "2385200"

        # 2. Point with invalid string coordinate (one valid, one invalid)
        p2 = proyecto.agregar_punto("P2")
        p2.longitud = "no_valid"
        p2.latitud = "2385640"

        # 3. Point with missing coordinate (one valid, one empty)
        p3 = proyecto.agregar_punto("P3")
        p3.longitud = "4955900"
        p3.latitud = ""

        # 4. Point with valid decimal coordinates (using both dot and comma)
        p4 = proyecto.agregar_punto("P4")
        p4.longitud = "4955736.5"
        p4.latitud = "2385200,8"

        # 5. Point with both invalid string coordinates
        p5 = proyecto.agregar_punto("P5")
        p5.longitud = "not_a_number"
        p5.latitud = "xyz"

        # 6. Point with both missing coordinates
        p6 = proyecto.agregar_punto("P6")
        p6.longitud = ""
        p6.latitud = ""

        resultado = puntos_con_coordenadas(proyecto)

        # Only P1 and P4 should have valid coordinates parsed
        self.assertEqual(len(resultado), 2)

        # Check P1
        self.assertEqual(resultado[0][0].nombre, "P1")
        self.assertEqual(resultado[0][1], 4955736.0)
        self.assertEqual(resultado[0][2], 2385200.0)

        # Check P4
        self.assertEqual(resultado[1][0].nombre, "P4")
        self.assertEqual(resultado[1][1], 4955736.5)
        self.assertEqual(resultado[1][2], 2385200.8)

    def test_empty_project(self):
        proyecto = Proyecto(nombre_proyecto="Prueba Vacio", cliente="Cliente Vacio")
        resultado = puntos_con_coordenadas(proyecto)
        self.assertEqual(resultado, [])

if __name__ == "__main__":
    unittest.main()
