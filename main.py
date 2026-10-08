"""Punto de entrada de la aplicacion de Procesamiento de Ruido Ambiental."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


if __name__ == "__main__":
    from gui.app import main
    main()
