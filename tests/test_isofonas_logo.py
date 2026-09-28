"""El mapa de isofonas incluye el logo de la empresa en el cuadro ELABORO
y se genera igual si el archivo del logo no existe."""
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.isophones import LOGO_DEFECTO, generar_mapa_isofonas_esquema  # noqa: E402
from core.models import Proyecto  # noqa: E402


def _resultados():
    proyecto = Proyecto(nombre_proyecto="Prueba", cliente="Cliente")
    por_punto = {}
    for nombre, x, y, nivel in [("P1", 4955736, 2385200, 49), ("P2", 4956450, 2385640, 57),
                                ("P3", 4955900, 2384870, 54)]:
        p = proyecto.agregar_punto(nombre)
        p.longitud, p.latitud = str(x), str(y)
        por_punto[p.no_punto] = {"DH": SimpleNamespace(lraeq_resultante=nivel)}
    return SimpleNamespace(proyecto=proyecto, por_punto=por_punto)


class TestLogoIsofonas(unittest.TestCase):
    def test_logo_incluido_en_el_repositorio(self):
        self.assertTrue(os.path.exists(LOGO_DEFECTO))

    def test_con_y_sin_logo(self):
        with tempfile.TemporaryDirectory() as tmp:
            con = generar_mapa_isofonas_esquema(_resultados(), "DH", os.path.join(tmp, "con.png"),
                                                con_basemap=False, generar_pdf=False)
            sin = generar_mapa_isofonas_esquema(_resultados(), "DH", os.path.join(tmp, "sin.png"),
                                                con_basemap=False, generar_pdf=False,
                                                logo_ruta=os.path.join(tmp, "no-existe.png"))
            self.assertTrue(os.path.getsize(con) > 0 and os.path.getsize(sin) > 0)
            # Con logo la imagen tiene mas contenido (colores del logo) que sin el.
            self.assertNotEqual(os.path.getsize(con), os.path.getsize(sin))


if __name__ == "__main__":
    unittest.main()
