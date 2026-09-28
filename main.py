"""Punto de entrada de la aplicacion de Procesamiento de Ruido Ambiental."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _selftest_isofonas():
    """Prueba de humo interna (no visible en la interfaz): genera un mapa de
    isofonas con mapa base real, para verificar que rasterio/GDAL funcionan
    correctamente dentro del ejecutable empaquetado. Uso: RuidoAmbiental.exe
    --selftest-isofonas"""
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
    carpeta = os.path.dirname(os.path.abspath(sys.argv[0]))
    log_path = os.path.join(carpeta, "selftest_isofonas.log")
    png_path = os.path.join(carpeta, "selftest_isofonas.png")
    try:
        ruta = generar_mapa_isofonas_esquema(resultados, "DH", png_path)
        tamano = os.path.getsize(ruta)
        # Un archivo pequeno (<200 KB) indica que el mapa base satelital no
        # se pudo descargar (revise conexion a internet o vea el traceback
        # si el error es otro).
        mensaje = f"OK: {ruta} ({tamano} bytes)."
        if tamano < 200_000:
            mensaje += " Advertencia: archivo pequeno, es probable que el mapa base satelital no se haya podido descargar."
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(mensaje)
    except Exception:  # noqa: BLE001
        import traceback
        with open(log_path, "w", encoding="utf-8") as f:
            f.write("ERROR:\n")
            f.write(traceback.format_exc())


if __name__ == "__main__":
    if "--selftest-isofonas" in sys.argv:
        _selftest_isofonas()
    else:
        from gui.app import main
        main()
