"""Genera las memorias sintéticas del sonómetro para la prueba de extremo a extremo.

Uso (desde la raíz del repositorio): python web/e2e/generar_memorias.py
"""
import os
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, RAIZ)

from engine.tests.memorias import crear_memoria  # noqa: E402

DESTINO = os.path.join(os.path.dirname(__file__), ".fixtures")
os.makedirs(DESTINO, exist_ok=True)
for i, direccion in enumerate(["Vertical", "Norte", "Sur", "Este", "Oeste"]):
    crear_memoria(os.path.join(DESTINO, f"P1_{direccion}.xlsx"), laeq=55.0 + i * 0.5, laieq=56.0)
print("Memorias en", DESTINO)
