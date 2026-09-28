# Procesamiento de Ruido Ambiental (Res. 0627)

Aplicacion de escritorio para Windows que automatiza la elaboracion de
informes de ruido ambiental: lee directamente las memorias exportadas del
sonometro, aplica la metodologia de ajustes de la Resolucion 0627 de 2006
(correccion por tono e impulsividad), calcula el nivel resultante por punto,
lo compara contra los estandares maximos permisibles, genera las graficas de
resultados y rellena automaticamente el informe final en Word.

> **Version web**: la misma aplicacion tambien funciona en linea, con usuarios,
> proyectos guardados en la nube y generacion de informes desde el navegador.
> Ver [`web/README.md`](web/README.md) (interfaz Next.js en `web/` y motor de
> calculo Python en `engine/`, que reutiliza el paquete `core/`).

## Que hace exactamente

1. **Lee las memorias del sonometro** (exportadas como `.xlsx` desde el
   software del equipo). Probado con Larson Davis **SoundTrack LxT1** y
   **SoundExpert 821** (formatos de hoja distintos, ambos soportados): toma
   de la hoja `Resumen` los niveles Lpico, Lmax, Lmin, L90, LAeq, LAIeq, el
   numero de serie del equipo y las horas de inicio/fin; y de la hoja `OBA`
   el espectro en tercios de octava.
2. **Aplica las correcciones de la Res. 0627** (replicando exactamente la
   logica de la matriz de procesamiento manual):
   - Correccion por impulsividad `KI` a partir de `|LAIeq - LAeq|`.
   - Correccion por tono `KT`, analizando el espectro en tercios de octava
     (suavizado de bandas vecinas + umbral de audibilidad por rango de
     frecuencia).
   - Correccion total = maximo entre `KI`, `KT` y correcciones manuales
     (pantalla antiviento, etc.).
   - `L90 corregido` y `LRAeq corregido` por direccion (Vertical, Norte,
     Sur, Este, Oeste).
   - Promedio energetico de las 5 direcciones = nivel resultante del punto
     (`LRAeq,1h`).
3. **Compara contra el estandar** de la tabla de sectores del Anexo 3 de la
   Res. 0627 (segun el sector asignado a cada punto) y determina
   cumplimiento.
4. **Genera las graficas** de nivel resultante +/- incertidumbre vs. estandar
   admisible, para jornada diurna y nocturna.
5. **Genera un mapa de isofonas por cada esquema de jornada** (Diurno Dia
   Habil, Diurno Dia No Habil, Nocturno Dia Habil, Nocturno Dia No Habil):
   curvas de igual nivel de presion sonora (isolineas etiquetadas) por
   interpolacion IDW a partir de las coordenadas de los puntos (Origen
   Nacional u otro sistema plano en metros, o Longitud/Latitud en grados) y
   el nivel resultante de cada uno, con la misma escala de clasificacion de
   niveles LRAeq dB(A) (`< 35` ... `80-85`) habitual en estos planos. Se
   necesitan al menos 3 puntos con coordenadas y resultados para ese esquema.
   **Se superpone sobre un mapa satelital real** (Esri World Imagery, la
   misma fuente que suele usarse en estos planos) mediante la libreria
   `contextily` -esto requiere conexion a internet al momento de generar el
   mapa; si no hay internet, el mapa se genera igual pero con fondo simple y
   un aviso en la imagen-. El plano sigue el mismo formato de layout que se
   usa actualmente: mapa con cuadricula de coordenadas Origen Nacional en
   los 4 lados y rosa de los vientos, y una columna lateral con mapa de
   localizacion general (recuadro rojo sobre una vista satelital mas
   amplia), leyenda de puntos de monitoreo, leyenda de la escala de colores
   (con nombre de color y rango, igual a los planos de referencia), cuadro
   con el nombre del proyecto/cliente/jornada, cuadro "Elaboro" y escala
   grafica. Cada mapa se guarda tanto en `.png` (para insertar en el Word)
   como en `.pdf` (para el anexo de isofonas del informe).
6. **Convierte automaticamente las coordenadas**: a partir del Este/Norte en
   el sistema Origen Nacional de Colombia (EPSG:9377, MAGNA-SIRGAS 2018 -
   Resolucion 471 de 2020 IGAC) que se ingresan por punto, calcula la
   Longitud/Latitud geografica en formato grados-minutos-segundos, sin
   necesidad de convertirlas a mano ni usar un GIS.
7. **Identifica los equipos usados**: a partir del numero de serie leido de
   cada memoria, busca el equipo en el inventario `equipos.json` (nombre y
   codigo interno) y diligencia la tabla de "Equipos de medicion" del
   informe. El inventario se edita desde el menu *Equipos > Editar
   inventario de equipos...* (agrega ahi los sonometros nuevos que compren,
   con su serial); si un serial no esta en el inventario, se incluye igual
   en la tabla (con el modelo leido de la memoria) para que quede visible y
   se pueda agregar despues.
8. **Rellena el informe final en Word** a partir de una plantilla `.docx`
   (por defecto, `templates/informe_template.docx`): ubica automaticamente
   las tablas de fecha y hora de monitoreo, el detalle por punto/direccion,
   el resumen LRAeq +/- incertidumbre, la comparacion con la norma, la
   relacion de puntos de monitoreo (coordenadas), los equipos de medicion y
   las tarjetas de descripcion por punto (nombre, coordenadas, foto y
   descripcion), e inserta las graficas y mapas de isofonas generados. El
   resto del informe (objetivos, generalidades, descripcion de fuentes,
   conclusiones, etc.) se sigue redactando a mano, ya que requiere criterio
   profesional.

> La plantilla incluida esta basada en la estructura del informe
> `ER-731-26_V1.docx`. Si tu empresa usa un formato distinto, reemplaza
> `templates/informe_template.docx` por tu propio formato **siempre que
> conserve los mismos encabezados de tabla** (la app ubica las tablas por
> su encabezado, no por posicion fija).

9. **Completa el capitulo de meteorologia** (opcional) a partir del archivo
   exportado de la estacion meteorologica (.xlsx): toma solo los registros de
   los dias de medicion (segun las horas de las memorias), llena la tabla de
   promedios diarios, redacta los textos de temperatura, humedad, presion,
   precipitacion y viento, y reemplaza las graficas y la rosa de vientos
   (16 direcciones, clases de velocidad como WRPLOT). En la app de escritorio
   se carga en *Datos generales > Datos meteorologicos*.

## Requisitos de las memorias del sonometro

- Un archivo `.xlsx` por punto, direccion (Vertical/Norte/Sur/Este/Oeste) y
  jornada (Diurno Dia Habil, Diurno Dia No Habil, Nocturno Dia Habil,
  Nocturno Dia No Habil).
- Debe conservar las hojas `Resumen` y `OBA` tal como las exporta el
  software del equipo (no renombrar columnas).

## Uso de la aplicacion

1. **Pestaña "1. Proyecto y puntos"**: cree el proyecto y agregue cada punto
   de monitoreo: nombre, sector segun la Res. 0627, incertidumbre de la
   tecnica, coordenadas Este/Norte (Origen Nacional -recomendado en
   Colombia- o Longitud/Latitud en grados), altitud opcional, una foto del
   punto y su descripcion. Las coordenadas se usan tanto para el mapa de
   isofonas como para la tabla de "Relacion de puntos de monitoreo" y las
   tarjetas de descripcion del informe; la foto y la descripcion solo para
   estas ultimas.
2. **Pestaña "2. Memorias del sonometro"**: para cada punto y jornada,
   asigne los 5 archivos `.xlsx` (uno por direccion del microfono).
3. **Pestaña "3. Procesar y generar informe"**:
   - **Procesar proyecto**: calcula todo y muestra la tabla comparativa
     contra la norma.
   - **Exportar Excel**: genera un libro con las hojas DH/DNH/NDH/NDNH
     (equivalente a la matriz de procesamiento manual) y la hoja de
     comparacion con la norma.
   - **Generar graficas**: guarda las graficas PNG de resultados.
   - **Generar mapas de isofonas**: guarda un mapa PNG por cada esquema
     (Diurno Habil, Diurno No Habil, Nocturno Habil, Nocturno No Habil) que
     tenga datos, con isolineas e imagen satelital de fondo (requiere
     internet en ese momento).
   - **Generar informe Word**: elige la plantilla `.docx` y la ruta de
     salida; la app rellena las tablas, gráficas y mapas de isofonas
     automaticamente (si no se generaron antes, los genera en ese momento).

El proyecto (puntos, sectores, rutas de archivos asignadas) se puede
**guardar y volver a abrir** desde el menu *Archivo*, para retomar el
trabajo en otra sesion.

## Instalacion (modo desarrollo)

```bash
cd ruido_app
python -m pip install -r requirements.txt
python main.py
```

## Generar el ejecutable (.exe)

Con Python y las dependencias instaladas (incluye `pyinstaller`, ya listado
en `requirements.txt`):

```bash
cd ruido_app
build_exe.bat
```

El ejecutable queda en `dist\RuidoAmbiental.exe` y puede copiarse a
cualquier computador con Windows sin necesidad de instalar Python.

## Estructura del proyecto

```
ruido_app/
  main.py                   Punto de entrada
  core/
    sonometer_reader.py     Lectura de memorias del sonometro (.xlsx)
    corrections.py          Motor de calculo (Res. 0627)
    norms.py                Tabla de estandares (Anexo 3, Res. 0627)
    models.py                Modelos de datos (Proyecto, Punto)
    pipeline.py              Orquesta el procesamiento completo
    excel_export.py          Exporta resultados a Excel
    charts.py                 Genera las graficas de resultados
    geo.py                     Conversion de coordenadas a metros locales
    geo_colombia.py             Origen Nacional (EPSG:9377) -> Longitud/Latitud
    isophones.py               Genera el mapa de isofonas (interpolacion IDW)
    equipos.py                 Inventario de equipos (busqueda por serial)
    docx_utils.py             Utilidades para editar tablas de Word
    report_generator.py       Rellena el informe final en Word
    project_io.py             Guardar/abrir proyecto (.json)
  gui/
    app.py                   Interfaz grafica (Tkinter)
  templates/
    informe_template.docx     Plantilla del informe final
  equipos.json                Inventario de equipos (editable, ver menu
                              Equipos > Editar inventario de equipos...)
  tests/
    test_corrections.py       Pruebas del motor de calculo
    test_geo.py                Pruebas de conversion de coordenadas
    test_geo_colombia.py        Pruebas de conversion Origen Nacional (con
                                puntos reales, exactitud milimetrica)
    test_equipos.py             Pruebas de busqueda de equipos por serial
```

> **Nota sobre `equipos.json`**: cuando se usa el `.exe` empaquetado, este
> archivo se busca/crea junto al propio `.exe` (no dentro del paquete
> temporal de PyInstaller), para que las ediciones se conserven entre
> ejecuciones.

## Limitaciones conocidas (v1)

- Se validó con memorias exportadas por sonómetros Larson Davis
  **SoundTrack LxT1** y **SoundExpert 821**. Otro fabricante o modelo puede
  requerir ajustar las etiquetas buscadas en `core/sonometer_reader.py`.
- Las secciones narrativas del informe (objetivos, generalidades,
  meteorologia, descripcion de fuentes, conclusiones) no se generan
  automaticamente: requieren redaccion profesional.
- El mapa de isofonas es una interpolacion IDW (el metodo estandar para
  pocos puntos de monitoreo, 3-8) superpuesta sobre un mapa satelital real,
  con un layout inspirado en el formato actual (localizacion general,
  leyendas, cuadro de proyecto, escala grafica). No es un plano GIS completo
  como los elaborados en ArcGIS/QGIS: el mapa de "localizacion general" es
  una vista satelital mas alejada con un recuadro rojo (no un mapa
  administrativo con limites de departamento/vereda, que requeriria una
  capa de limites politicos que la app no trae incluida), y el cuadro
  "Elaboro" es solo texto (sin logo de la empresa, salvo que se agregue mas
  adelante). Requiere conexion a internet al generarlo (para descargar las
  teselas satelitales); sin internet, se genera igual pero con fondo simple.
- Los mapas de isofonas dependen de `contextily`/`rasterio`, que agregan
  bastante peso y tiempo de compilacion al `.exe` (unos 60-90 s adicionales
  al generar el ejecutable). Si `RuidoAmbiental.exe --selftest-isofonas`
  genera un `selftest_isofonas.png` pequeno (<200 KB) o un
  `selftest_isofonas.log` con "ERROR", revise la conexion a internet o que
  el `.exe` se haya generado con `--collect-all rasterio` y
  `--hidden-import matplotlib.backends.backend_pdf` (ya incluidos en
  `build_exe.bat`).
