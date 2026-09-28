"""Pruebas de la API del motor: descarga de archivos por URL, procesamiento
y generacion de entregables (Excel, Word y anexos)."""
import functools
import io
import json
import os
import sys
import tempfile
import threading
import unittest
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
os.environ["ENGINE_API_KEY"] = "clave-de-prueba"
os.environ["ENGINE_BASEMAP"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from core.corrections import promedio_energetico  # noqa: E402
from engine.app import app  # noqa: E402
from engine.tests.memorias import crear_memoria  # noqa: E402

DIRECCIONES = ["Vertical", "Norte", "Sur", "Este", "Oeste"]
AUTH = {"Authorization": "Bearer clave-de-prueba"}
SECTOR_B = ("B - Tranquilidad y ruido moderado - Zonas residenciales o exclusivamente "
            "destinadas para desarrollo habitacional, hoteleria y hospedajes.")
COORDENADAS = [(4919855.125, 2309786.167), (4921029.181, 2305271.928), (4919539.506, 2308027.992)]


class _Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class TestApiMotor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        handler = functools.partial(_Silencioso, directory=cls.tmp.name)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.tmp.cleanup()

    def _proyecto(self, n_puntos=3, laeq=55.0):
        puntos = []
        for i in range(n_puntos):
            memorias = {"DH": {}}
            for j, d in enumerate(DIRECCIONES):
                nombre = f"P{i + 1}_{d}.xlsx"
                crear_memoria(os.path.join(self.tmp.name, nombre), laeq=laeq + i + j * 0.5, laieq=laeq + i + 1)
                memorias["DH"][d] = {"url": f"{self.base}/{nombre}", "nombre": nombre}
            este, norte = COORDENADAS[i]
            puntos.append({
                "no_punto": i + 1, "nombre": f"P{i + 1}", "sector": SECTOR_B,
                "este": str(este), "norte": str(norte), "incertidumbre": 0.0043,
                "memorias": memorias,
            })
        return {"nombre_proyecto": "Prueba", "codigo_informe": "ER-001-26", "cliente": "Cliente", "puntos": puntos}

    def test_requiere_clave(self):
        r = self.client.post("/v1/procesar", json={"proyecto": {"puntos": []}})
        self.assertEqual(r.status_code, 401)

    def test_procesar(self):
        r = self.client.post("/v1/procesar", json={"proyecto": self._proyecto()}, headers=AUTH)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(len(data["puntos"]), 3)
        p1 = data["puntos"][0]
        self.assertEqual(p1["estandar_diurno"], 65)
        dh = p1["esquemas"]["DH"]
        self.assertEqual(len(dh["direcciones"]), 5)
        esperado = promedio_energetico([d["lraeq_corregido"] for d in dh["direcciones"]])
        self.assertAlmostEqual(dh["lraeq_resultante"], esperado, places=3)
        self.assertEqual(p1["cumple"]["DH"], "Si")
        self.assertEqual(data["equipos_detectados"], [{"serial": "0006599", "modelo": "SoundTrack LxT1"}])

    def test_direccion_faltante_genera_advertencia(self):
        proyecto = self._proyecto(n_puntos=1)
        del proyecto["puntos"][0]["memorias"]["DH"]["Oeste"]
        r = self.client.post("/v1/procesar", json={"proyecto": proyecto}, headers=AUTH)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any("Oeste" in a["direccion"] for a in r.json()["advertencias"]))

    def test_memoria_invalida_muestra_nombre_original(self):
        proyecto = self._proyecto(n_puntos=1)
        with open(os.path.join(self.tmp.name, "roto.xlsx"), "wb") as f:
            f.write(b"no es un excel")
        proyecto["puntos"][0]["memorias"]["DH"]["Norte"] = {"url": f"{self.base}/roto.xlsx", "nombre": "roto.xlsx"}
        r = self.client.post("/v1/procesar", json={"proyecto": proyecto}, headers=AUTH)
        mensajes = [a["mensaje"] for a in r.json()["advertencias"]]
        self.assertTrue(any("roto.xlsx" in m and "ruido_" not in m for m in mensajes), mensajes)

    def test_descarga_fallida(self):
        proyecto = self._proyecto(n_puntos=1)
        proyecto["puntos"][0]["memorias"]["DH"]["Norte"]["url"] = f"{self.base}/no-existe.xlsx"
        r = self.client.post("/v1/procesar", json={"proyecto": proyecto}, headers=AUTH)
        self.assertEqual(r.status_code, 502)

    def test_generar_excel(self):
        r = self.client.post("/v1/generar", json={"proyecto": self._proyecto(), "tipo": "excel"}, headers=AUTH)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(unquote(r.headers["x-nombre-archivo"]), "ER-001-26 - Resultados.xlsx")
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(r.content))
        self.assertIn("DH", wb.sheetnames)
        self.assertIn("Comparacion Norma", wb.sheetnames)

    def test_generar_word(self):
        cuerpo = {
            "proyecto": self._proyecto(), "tipo": "word",
            "equipos": [{"nombre": "Sonometro X", "codigo": "612-C", "serial": "6599"}],
        }
        r = self.client.post("/v1/generar", json=cuerpo, headers=AUTH)
        self.assertEqual(r.status_code, 200, r.text)
        import docx
        doc = docx.Document(io.BytesIO(r.content))
        texto = "\n".join(c.text for t in doc.tables for row in t.rows for c in row.cells)
        self.assertIn("612-C", texto)
        self.assertIsInstance(json.loads(unquote(r.headers["x-advertencias"])), list)

    def test_generar_word_plantilla_invalida(self):
        with open(os.path.join(self.tmp.name, "plantilla_mala.docx"), "wb") as f:
            f.write(b"")
        cuerpo = {"proyecto": self._proyecto(n_puntos=1), "tipo": "word",
                  "plantilla": {"url": f"{self.base}/plantilla_mala.docx", "nombre": "p.docx"}}
        r = self.client.post("/v1/generar", json=cuerpo, headers=AUTH)
        self.assertEqual(r.status_code, 422)

    def test_generar_anexos(self):
        r = self.client.post("/v1/generar", json={"proyecto": self._proyecto(), "tipo": "anexos"}, headers=AUTH)
        self.assertEqual(r.status_code, 200, r.text)
        nombres = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
        self.assertIn("graficas/grafica_diurna.png", nombres)
        self.assertIn("isofonas/isofonas_DH.png", nombres)
        self.assertIn("isofonas/isofonas_DH.pdf", nombres)


if __name__ == "__main__":
    unittest.main()
