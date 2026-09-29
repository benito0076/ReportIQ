"""La lista de sectores que muestra la web (web/src/lib/sectores.json) debe
coincidir exactamente con la tabla del motor: el motor identifica el sector
de cada punto por su etiqueta. Incluye los estandares de emision (Art. 9)."""
import json
import os
import sys
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)

from core import norms  # noqa: E402
from core.emision import estandares_emision  # noqa: E402


class TestSectoresWeb(unittest.TestCase):
    def test_coinciden(self):
        with open(os.path.join(RAIZ, "web", "src", "lib", "sectores.json"), encoding="utf-8") as f:
            web = json.load(f)
        motor = [{"etiqueta": s.etiqueta, "sector": s.sector, "dia": s.dia, "noche": s.noche,
                  "emisionDia": estandares_emision(s.etiqueta)[0], "emisionNoche": estandares_emision(s.etiqueta)[1]}
                 for s in norms.TABLA_RES_0627]
        self.assertEqual(web, motor)


if __name__ == "__main__":
    unittest.main()
