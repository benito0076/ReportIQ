import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestSelftestIsofonas(unittest.TestCase):
    def test_selftest_isofonas(self):
        """Prueba de humo interna (no visible en la interfaz): genera un mapa de
        isofonas con mapa base real, para verificar que rasterio/GDAL funcionan
        correctamente."""
        from types import SimpleNamespace
        from core.models import Proyecto
        from core.isophones import generar_mapa_isofonas_esquema

        proyecto = Proyecto(nombre_proyecto="Autoprueba")
        datos = [("P1", 4919855.125, 2309786.167, 60.0), ("P2", 4921029.181, 2305271.928, 55.0),
                 ("P3", 4919539.506, 2308027.992, 58.0)]
        por_punto = {}
        for nombre, x, y, nivel in datos:
            p = proyecto.agregar_punto(nombre)
            p.longitud, p.latitud = str(x), str(y)
            por_punto[p.no_punto] = {"DH": SimpleNamespace(lraeq_resultante=nivel)}
        resultados = SimpleNamespace(proyecto=proyecto, por_punto=por_punto)

        with tempfile.TemporaryDirectory() as tmp_dir:
            png_path = os.path.join(tmp_dir, "selftest_isofonas.png")
            ruta = generar_mapa_isofonas_esquema(resultados, "DH", png_path)
            self.assertTrue(os.path.exists(ruta))
            tamano = os.path.getsize(ruta)

            # Si el mapa base no se descarga (sin internet),
            # el archivo es pequeno (<200KB) pero igual se genera algo valido.
            # Solo verificamos que se genere una imagen >0 bytes.
            self.assertGreater(tamano, 0)

if __name__ == "__main__":
    unittest.main()
