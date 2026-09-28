@echo off
REM Genera el ejecutable RuidoAmbiental.exe (un solo archivo, sin consola).
REM Ejecutar este .bat desde dentro de la carpeta ruido_app.

REM --collect-all rasterio es necesario porque PyInstaller no detecta solo
REM algunos submodulos internos de rasterio (usado por contextily para el
REM mapa base satelital de los planos de isofonas); sin esto, la app arranca
REM bien pero falla al generar el mapa base con "ModuleNotFoundError:
REM rasterio.serde" o similar.
REM --hidden-import matplotlib.backends.backend_pdf es necesario porque los
REM mapas de isofonas tambien se exportan en .pdf; sin esto, PyInstaller solo
REM detecta el backend Agg (usado para los .png) y falla al guardar el .pdf.
python -m PyInstaller --noconfirm --onefile --windowed --name "RuidoAmbiental" ^
    --add-data "templates;templates" ^
    --collect-all rasterio ^
    --hidden-import matplotlib.backends.backend_pdf ^
    main.py

echo.
echo Listo. El ejecutable queda en dist\RuidoAmbiental.exe
echo Copie tambien equipos.json a la carpeta dist para que la app lo encuentre.
copy /Y equipos.json dist\equipos.json >nul
pause
