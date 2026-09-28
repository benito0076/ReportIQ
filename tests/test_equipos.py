import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.equipos import DEFAULT_EQUIPOS, Equipo, buscar_por_serial, normalizar_serial


class TestEquipos(unittest.TestCase):
    def test_normaliza_ceros_a_la_izquierda(self):
        self.assertEqual(normalizar_serial("0006599"), normalizar_serial(6599))
        self.assertEqual(normalizar_serial("6599"), normalizar_serial("0006599"))

    def test_busca_soundexpert_821(self):
        equipos = [Equipo(**e) for e in DEFAULT_EQUIPOS]
        equipo = buscar_por_serial(equipos, "40799")
        self.assertIsNotNone(equipo)
        self.assertEqual(equipo.codigo, "1016-C")

    def test_busca_soundtrack_lxt_con_serial_numerico_sin_ceros(self):
        equipos = [Equipo(**e) for e in DEFAULT_EQUIPOS]
        # El LxT guarda el serial como numero (6599), sin los ceros a la
        # izquierda que si aparecen en el inventario ('0006599').
        equipo = buscar_por_serial(equipos, 6599)
        self.assertIsNotNone(equipo)
        self.assertEqual(equipo.codigo, "612-C")

    def test_serial_desconocido(self):
        equipos = [Equipo(**e) for e in DEFAULT_EQUIPOS]
        self.assertIsNone(buscar_por_serial(equipos, "99999999"))


if __name__ == "__main__":
    unittest.main()
