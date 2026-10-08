import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.isophones import generar_mapa_localizacion, SinCoordenadasError
from core.models import Proyecto

class TestMapaLocalizacion(unittest.TestCase):
    def setUp(self):
        self.proyecto = Proyecto(nombre_proyecto="Prueba", cliente="Cliente")

    def test_sin_coordenadas_lanza_error(self):
        # Proyecto sin puntos
        with self.assertRaises(SinCoordenadasError):
            generar_mapa_localizacion(self.proyecto, "ruta_falsa.png")

        # Proyecto con puntos pero sin coordenadas
        self.proyecto.agregar_punto("P1")
        with self.assertRaises(SinCoordenadasError):
            generar_mapa_localizacion(self.proyecto, "ruta_falsa.png")

    def test_generar_mapa_exito(self):
        # Proyecto con puntos y coordenadas
        p1 = self.proyecto.agregar_punto("P1")
        p1.longitud, p1.latitud = "4955736", "2385200"
        p2 = self.proyecto.agregar_punto("P2")
        p2.longitud, p2.latitud = "4956450", "2385640"

        with tempfile.TemporaryDirectory() as tmp:
            ruta_salida = os.path.join(tmp, "mapa.png")
            generar_mapa_localizacion(self.proyecto, ruta_salida, con_basemap=False)
            self.assertTrue(os.path.exists(ruta_salida))
            self.assertGreater(os.path.getsize(ruta_salida), 0)

    def test_generar_mapa_pdf(self):
        # Proyecto con puntos y coordenadas
        p1 = self.proyecto.agregar_punto("P1")
        p1.longitud, p1.latitud = "4955736", "2385200"

        with tempfile.TemporaryDirectory() as tmp:
            ruta_salida = os.path.join(tmp, "mapa.pdf")
            generar_mapa_localizacion(self.proyecto, ruta_salida, con_basemap=False, generar_pdf=True)
            self.assertTrue(os.path.exists(ruta_salida))
            self.assertGreater(os.path.getsize(ruta_salida), 0)

if __name__ == "__main__":
    unittest.main()
