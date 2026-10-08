import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.isophones import generar_mapas_isofonas, SinCoordenadasError
from core.models import ESQUEMA_LABELS

class TestGenerarMapasIsofonas(unittest.TestCase):
    @patch('core.isophones.generar_mapa_isofonas_esquema')
    def test_generar_mapas_isofonas_success(self, mock_generar_esquema):
        # Configurar el mock para que devuelva una ruta de archivo simulada
        def side_effect(resultados, esquema, ruta_salida, **kwargs):
            return ruta_salida
        mock_generar_esquema.side_effect = side_effect

        resultados_mock = "mock_resultados"
        carpeta = "salida_test"

        rutas = generar_mapas_isofonas(resultados_mock, carpeta)

        # Debe intentar generar mapas para todos los esquemas
        self.assertEqual(mock_generar_esquema.call_count, len(ESQUEMA_LABELS))

        # Verificar que el diccionario de retorno tiene todos los esquemas
        self.assertEqual(len(rutas), len(ESQUEMA_LABELS))
        for esquema in ESQUEMA_LABELS:
            self.assertIn(esquema, rutas)
            self.assertEqual(rutas[esquema], os.path.join(carpeta, f"isofonas_{esquema}.png"))

    @patch('core.isophones.generar_mapa_isofonas_esquema')
    def test_generar_mapas_isofonas_handles_exception(self, mock_generar_esquema):
        # Configurar el mock para que falle en el segundo esquema ("DNH" asumiendo el orden, o simplemente en uno específico)
        esquema_que_falla = list(ESQUEMA_LABELS.keys())[1]

        def side_effect(resultados, esquema, ruta_salida, **kwargs):
            if esquema == esquema_que_falla:
                raise SinCoordenadasError("No se pudo generar")
            return ruta_salida
        mock_generar_esquema.side_effect = side_effect

        resultados_mock = "mock_resultados"
        carpeta = "salida_test"

        # La función no debe levantar la excepción
        rutas = generar_mapas_isofonas(resultados_mock, carpeta)

        # Debe haber intentado con todos los esquemas
        self.assertEqual(mock_generar_esquema.call_count, len(ESQUEMA_LABELS))

        # El esquema que falló no debe estar en el resultado
        self.assertNotIn(esquema_que_falla, rutas)
        # Los demás sí deben estar
        self.assertEqual(len(rutas), len(ESQUEMA_LABELS) - 1)

    @patch('core.isophones.generar_mapa_isofonas_esquema')
    def test_generar_mapas_isofonas_args(self, mock_generar_esquema):
        mock_generar_esquema.return_value = "ruta.png"
        resultados_mock = "mock_resultados"
        carpeta = "salida_test"

        # Probar con valores específicos para los kwargs
        rutas = generar_mapas_isofonas(resultados_mock, carpeta, con_basemap=False, generar_pdf=False)

        # Verificar que la llamada al mock tuvo los kwargs correctos
        mock_generar_esquema.assert_called_with(
            resultados_mock,
            list(ESQUEMA_LABELS.keys())[-1], # El último esquema iterado
            os.path.join(carpeta, f"isofonas_{list(ESQUEMA_LABELS.keys())[-1]}.png"),
            con_basemap=False,
            generar_pdf=False
        )

if __name__ == '__main__':
    unittest.main()
