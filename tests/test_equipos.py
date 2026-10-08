import os
import sys
import unittest
import tempfile
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.equipos import DEFAULT_EQUIPOS, Equipo, buscar_por_serial, normalizar_serial, guardar_equipos, cargar_equipos


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

    def test_guardar_equipos(self):
        equipos = [
            Equipo(nombre="Equipo 1", codigo="E01", serial="1234"),
            Equipo(nombre="Equipo 2", codigo="E02", serial="5678")
        ]

        with tempfile.NamedTemporaryFile(mode="w", delete=False, encoding="utf-8", suffix=".json") as f:
            temp_file_path = f.name

        try:
            guardar_equipos(equipos, temp_file_path)

            with open(temp_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["nombre"], "Equipo 1")
            self.assertEqual(data[0]["codigo"], "E01")
            self.assertEqual(data[0]["serial"], "1234")

            self.assertEqual(data[1]["nombre"], "Equipo 2")
            self.assertEqual(data[1]["codigo"], "E02")
            self.assertEqual(data[1]["serial"], "5678")
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    def test_cargar_equipos_sin_ruta(self):
        equipos = cargar_equipos()
        self.assertEqual(len(equipos), len(DEFAULT_EQUIPOS))
        self.assertEqual(equipos[0].codigo, DEFAULT_EQUIPOS[0]["codigo"])
        self.assertIsInstance(equipos[0], Equipo)

    def test_cargar_equipos_ruta_invalida(self):
        equipos = cargar_equipos("ruta_que_no_existe.json")
        self.assertEqual(len(equipos), len(DEFAULT_EQUIPOS))
        self.assertEqual(equipos[0].codigo, DEFAULT_EQUIPOS[0]["codigo"])
        self.assertIsInstance(equipos[0], Equipo)

    def test_cargar_equipos_ruta_valida(self):
        datos_prueba = [
            {"nombre": "Sonometro Prueba", "codigo": "123-P", "serial": "0001"}
        ]
        with tempfile.NamedTemporaryFile(mode="w", delete=False, encoding="utf-8", suffix=".json") as f:
            json.dump(datos_prueba, f)
            temp_path = f.name

        try:
            equipos = cargar_equipos(temp_path)
            self.assertEqual(len(equipos), 1)
            self.assertEqual(equipos[0].nombre, "Sonometro Prueba")
            self.assertEqual(equipos[0].codigo, "123-P")
            self.assertEqual(equipos[0].serial, "0001")
            self.assertIsInstance(equipos[0], Equipo)
        finally:
            os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
