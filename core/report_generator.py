"""Genera el informe final en Word a partir de una plantilla .docx (con la
misma estructura de tablas que ER-731-26_V1.docx) y los resultados calculados
por el pipeline de procesamiento."""
from __future__ import annotations

import logging
import os
import zipfile

import docx

logger = logging.getLogger(__name__)

from .docx_utils import (
    ajustar_bloques_de_filas,
    eliminar_tabla,
    encontrar_tabla,
    encontrar_tabla_por_contexto,
    encontrar_tablas,
    escribir_filas,
    insertar_imagen_despues_de,
    insertar_texto_despues_de,
    set_cell_image,
    set_cell_lines,
    set_cell_text,
)
from .equipos import buscar_por_serial, cargar_equipos
from .geo import parsear_coordenada
from .geo_colombia import es_origen_nacional, geograficas_desde_origen_nacional
from .models import DIRECCIONES, ESQUEMA_LABELS, ESQUEMAS


class ErrorPlantilla(Exception):
    pass


def _validar_plantilla(ruta_plantilla: str):
    if not os.path.exists(ruta_plantilla):
        raise ErrorPlantilla(f"No se encontro el archivo de plantilla:\n{ruta_plantilla}")
    if os.path.getsize(ruta_plantilla) == 0:
        raise ErrorPlantilla(
            "El archivo de plantilla esta vacio (0 KB).\n\n"
            "Esto suele pasar con un documento creado desde 'Nuevo > Documento de Word' "
            "en el Explorador de Windows que nunca se abrio y se guardo en Word.\n\n"
            "Use la plantilla incluida en la carpeta 'templates' de la aplicacion, o una "
            "copia de un informe ya elaborado que conserve las mismas tablas."
        )
    if not zipfile.is_zipfile(ruta_plantilla):
        raise ErrorPlantilla(
            "El archivo seleccionado no es un documento Word (.docx) valido "
            "(puede estar danado o ser en realidad un .doc antiguo).\n\n"
            "Use la plantilla incluida en la carpeta 'templates' de la aplicacion, o una "
            "copia de un informe ya elaborado que conserve las mismas tablas."
        )


def fmt_es(valor, decimales=1):
    if valor is None or valor == "":
        return ""
    if isinstance(valor, str):
        return valor
    texto = f"{valor:.{decimales}f}"
    return texto.replace(".", ",")


def _filas_fecha_hora(resultados_proyecto, esquema_h, esquema_nh):
    filas = []
    for punto in resultados_proyecto.proyecto.puntos:
        rp_h = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema_h)
        rp_nh = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema_nh)
        filas.append([
            punto.nombre,
            str(rp_h.inicio) if rp_h and rp_h.inicio else "",
            str(rp_h.fin) if rp_h and rp_h.fin else "",
            str(rp_nh.inicio) if rp_nh and rp_nh.inicio else "",
            str(rp_nh.fin) if rp_nh and rp_nh.fin else "",
        ])
    return filas


def _filas_resumen_lraeq(resultados_proyecto, esquema_h, esquema_nh):
    filas = []
    for punto in resultados_proyecto.proyecto.puntos:
        rp_h = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema_h)
        rp_nh = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema_nh)
        inc = punto.incertidumbre or 0
        nivel_h = rp_h.lraeq_resultante if rp_h else None
        nivel_nh = rp_nh.lraeq_resultante if rp_nh else None
        filas.append([
            punto.nombre,
            fmt_es(nivel_h),
            fmt_es(inc, 4),
            fmt_es(nivel_h - inc) if nivel_h is not None else "",
            fmt_es(nivel_h + inc) if nivel_h is not None else "",
            fmt_es(nivel_nh),
            fmt_es(inc, 4),
            fmt_es(nivel_nh - inc) if nivel_nh is not None else "",
            fmt_es(nivel_nh + inc) if nivel_nh is not None else "",
        ])
    return filas


def _filas_detalle(resultados_proyecto, esquema):
    filas = []
    for punto in resultados_proyecto.proyecto.puntos:
        rp = resultados_proyecto.por_punto.get(punto.no_punto, {}).get(esquema)
        if rp is None:
            continue
        inc = punto.incertidumbre or 0
        for direccion in DIRECCIONES:
            rd = rp.direcciones.get(direccion)
            if rd is None:
                continue
            filas.append([
                punto.nombre, direccion,
                fmt_es(rd.lpico), fmt_es(rd.lmax), fmt_es(rd.lmin),
                fmt_es(rd.l90), fmt_es(rd.laeq), fmt_es(rd.laieq),
                fmt_es(rd.li), fmt_es(rd.ki), fmt_es(rd.kt), fmt_es(rd.ks),
                fmt_es(rd.correccion_pantalla), fmt_es(rd.correccion),
                fmt_es(rd.l90_corregido), fmt_es(rd.lraeq_corregido),
                fmt_es(rp.lraeq_resultante), fmt_es(inc, 4),
            ])
    return filas


def _filas_comparacion(resultados_proyecto, jornada: str):
    filas = []
    for rc in resultados_proyecto.comparacion.values():
        if jornada == "diurno":
            filas.append([
                rc.punto.nombre, fmt_es(rc.lraeq_dh), rc.cumple_dh or "",
                fmt_es(rc.lraeq_dnh), rc.cumple_dnh or "", fmt_es(rc.estandar_diurno, 0),
            ])
        else:
            filas.append([
                rc.punto.nombre, fmt_es(rc.lraeq_ndh), rc.cumple_ndh or "",
                fmt_es(rc.lraeq_ndnh), rc.cumple_ndnh or "", fmt_es(rc.estandar_nocturno, 0),
            ])
    return filas


def _fmt_coordenada_plana(valor):
    if valor is None:
        return ""
    # Sin separador de miles, con coma decimal: igual al estilo del informe
    # (p.ej. 4919855,125).
    return f"{valor:.3f}".replace(".", ",")


def _filas_relacion_puntos(proyecto):
    """Filas para la tabla 'Relacion puntos de monitoreo de ruido ambiental'
    (Nombre, Longitud DMS, Latitud DMS, Este, Norte), derivando las
    coordenadas geograficas a partir del Este/Norte en Origen Nacional."""
    filas = []
    for punto in proyecto.puntos:
        x = parsear_coordenada(punto.longitud)
        y = parsear_coordenada(punto.latitud)
        if x is None or y is None:
            filas.append([punto.nombre, "", "", "", ""])
            continue
        lon_dms, lat_dms, _, _ = geograficas_desde_origen_nacional(x, y)
        if es_origen_nacional(x, y):
            este_txt, norte_txt = _fmt_coordenada_plana(x), _fmt_coordenada_plana(y)
        else:
            este_txt, norte_txt = "", ""
        filas.append([punto.nombre, lon_dms, lat_dms, este_txt, norte_txt])
    return filas


def _llenar_tarjetas_puntos(doc, requeridos=("nombre del punto", "longitud/este", "latitud/norte")):
    """Llena las 'tarjetas' de descripcion por punto (Nombre, coordenadas,
    foto y descripcion), replicando la estructura de 7 filas por punto de
    la plantilla (encabezado propio + Coordenadas Geograficas + Coordenadas
    Origen Nacional + Descripcion del punto + foto/texto)."""
    coincidencias = encontrar_tablas(
        doc, requeridos=list(requeridos), filas_encabezado=1
    )
    if not coincidencias:
        return False

    tabla_principal = coincidencias[0][1]
    for _, tabla_extra in coincidencias[1:]:
        eliminar_tabla(tabla_extra)

    if len(tabla_principal.rows) < 7:
        return False  # la plantilla no tiene ni una tarjeta completa de 7 filas

    return tabla_principal


def _escribir_tarjeta(tabla, indice_bloque: int, punto, latitud_primero: bool = False):
    """`latitud_primero`: la plantilla pone Latitud/Norte en la 2a columna y
    Longitud/Este en la 3a (informe de emision); si no, al reves (ambiental)."""
    base = indice_bloque * 7
    x = parsear_coordenada(punto.longitud)
    y = parsear_coordenada(punto.latitud)
    c_lon, c_lat = (2, 1) if latitud_primero else (1, 2)

    set_cell_text(tabla.cell(base + 2, 0), punto.nombre)
    if x is not None and y is not None:
        lon_dms, lat_dms, _, _ = geograficas_desde_origen_nacional(x, y)
        set_cell_text(tabla.cell(base + 2, c_lon), lon_dms)
        set_cell_text(tabla.cell(base + 2, c_lat), lat_dms)
        if es_origen_nacional(x, y):
            set_cell_text(tabla.cell(base + 4, c_lon), _fmt_coordenada_plana(x))
            set_cell_text(tabla.cell(base + 4, c_lat), _fmt_coordenada_plana(y))
        else:
            set_cell_text(tabla.cell(base + 4, 1), "")
            set_cell_text(tabla.cell(base + 4, 2), "")
    else:
        for r, c in ((2, 1), (2, 2), (4, 1), (4, 2)):
            set_cell_text(tabla.cell(base + r, c), "")

    celda_foto = tabla.cell(base + 6, 0)
    if punto.foto_ruta and os.path.exists(punto.foto_ruta):
        try:
            set_cell_image(celda_foto, punto.foto_ruta, ancho_emu=1500000)
        except Exception as e:  # noqa: BLE001
            logger.warning("Error al insertar imagen %s en tarjeta de punto: %s", punto.foto_ruta, e)
            # imagen invalida/no soportada: se deja el contenido previo de la celda
    else:
        # Sin foto: se quita la de la plantilla (es de otro proyecto).
        for dibujo in list(celda_foto._tc.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing")):
            dibujo.getparent().remove(dibujo)

    descripcion = punto.descripcion or ""
    if punto.altitud:
        descripcion = f"{descripcion}\n\nAltitud: {punto.altitud} m.s.n.m."
    set_cell_lines(tabla.cell(base + 6, 1), descripcion.split("\n"))


def _filas_equipos(resultados_proyecto, ruta_equipos=None):
    """Filas (Nombre, Codigo, Serial) para la tabla de equipos de medicion,
    a partir de los numeros de serie leidos en las memorias y el inventario
    de equipos (equipos.json)."""
    equipos = cargar_equipos(ruta_equipos)
    filas = []
    for serial, modelo in resultados_proyecto.equipos_detectados.items():
        equipo = buscar_por_serial(equipos, serial)
        if equipo:
            filas.append([equipo.nombre, equipo.codigo, equipo.serial])
        else:
            # Equipo no registrado en equipos.json: se incluye igual con lo
            # que se pudo leer de la memoria, para que quede visible y se
            # pueda agregar al inventario despues.
            filas.append([modelo or "Equipo no registrado", "", str(serial)])
    return filas


def _reemplazar_imagen_tras_leyenda(doc, palabras, ruta_imagen) -> bool:
    """Cambia la primera imagen que sigue a la leyenda (p. ej. 'Imagen 1.
    Localizacion ...') por `ruta_imagen`. Devuelve False si no la encuentra."""
    from docx.text.paragraph import Paragraph

    from .docx_utils import _sin_tildes, blips, reemplazar_imagen

    cuerpo = list(doc.element.body.iterchildren())
    for i, el in enumerate(cuerpo):
        if not el.tag.endswith("}p"):
            continue
        parrafo = Paragraph(el, doc)
        if (parrafo.style.name or "").lower().startswith(("toc", "table of figures")):
            continue  # entrada del indice de imagenes
        texto = _sin_tildes(parrafo.text.strip())
        if texto.startswith(palabras[0]) and all(p in texto for p in palabras[1:]):
            for siguiente in [el] + cuerpo[i + 1:i + 4]:
                encontrados = blips(siguiente)
                if encontrados:
                    reemplazar_imagen(doc, encontrados[0], ruta_imagen)
                    return True
            return False
    return False


def generar_informe(
    resultados_proyecto, ruta_plantilla: str, ruta_salida: str,
    graficas: dict | None = None, isofonas: dict | None = None, ruta_equipos: str | None = None,
    meteo=None, hoy=None,
):
    """`meteo` = (analisis, graficas_meteo) de core/meteorologia.py; si se
    indica, reemplaza el contenido del capitulo de meteorologia."""
    _validar_plantilla(ruta_plantilla)
    try:
        doc = docx.Document(ruta_plantilla)
    except Exception as exc:
        raise ErrorPlantilla(
            f"No se pudo abrir la plantilla como documento Word:\n{exc}\n\n"
            "Use la plantilla incluida en la carpeta 'templates' de la aplicacion, o una "
            "copia de un informe ya elaborado que conserve las mismas tablas."
        ) from exc
    graficas = graficas or {}
    faltantes = []
    total_verificaciones = 0

    # --- Relacion de puntos de monitoreo (coordenadas) ---
    total_verificaciones += 1
    _, t_relacion = encontrar_tabla(
        doc, requeridos=["puntos de monitoreo", "coordenadas geograficas", "origen nacional"],
        filas_encabezado=2,
    )
    if t_relacion is not None:
        escribir_filas(t_relacion, 2, _filas_relacion_puntos(resultados_proyecto.proyecto))
    else:
        faltantes.append("Relacion de puntos de monitoreo (coordenadas)")

    # --- Tarjetas de descripcion por punto (nombre, coordenadas, foto, texto) ---
    total_verificaciones += 1
    tabla_tarjetas = _llenar_tarjetas_puntos(doc)
    if tabla_tarjetas:
        n_puntos = len(resultados_proyecto.proyecto.puntos)
        ajustar_bloques_de_filas(tabla_tarjetas, 7, n_puntos)
        for i, punto in enumerate(resultados_proyecto.proyecto.puntos):
            _escribir_tarjeta(tabla_tarjetas, i, punto)
    else:
        faltantes.append("Descripcion de los puntos de medicion (tarjetas)")

    # --- Equipos de medicion (sonometros usados, segun serial leido) ---
    total_verificaciones += 1
    t_equipos = encontrar_tabla_por_contexto(
        doc, requeridos=["nombre", "codigo", "serial"],
        contexto_excluido=["calibrador"], filas_encabezado=1,
    )
    filas_equipos = _filas_equipos(resultados_proyecto, ruta_equipos)
    if t_equipos is not None and resultados_proyecto.equipos_detectados:
        escribir_filas(t_equipos, 1, filas_equipos)
    elif not resultados_proyecto.equipos_detectados:
        faltantes.append("Equipos de medicion (no se detecto ningun numero de serie en las memorias)")
    else:
        faltantes.append("Equipos de medicion")

    # --- Fecha y hora de monitoreo (Diurno / Nocturno) ---
    # Ambas tablas comparten el mismo encabezado textual ("Dia Habil" / "Dia No
    # Habil" / "Fecha y hora de..."); la unica forma de distinguirlas es por su
    # orden de aparicion en el documento (primero Diurno, luego Nocturno),
    # igual que en la hoja "Fecha y Hora de Monitoreo" de la matriz original.
    fecha_hora = encontrar_tablas(doc, requeridos=["dia habil", "fecha y hora de inicio"], filas_encabezado=2)
    total_verificaciones += 2
    if len(fecha_hora) >= 1:
        escribir_filas(fecha_hora[0][1], 2, _filas_fecha_hora(resultados_proyecto, "DH", "DNH"))
    else:
        faltantes.append("Fecha y hora de monitoreo (diurno)")
    if len(fecha_hora) >= 2:
        escribir_filas(fecha_hora[1][1], 2, _filas_fecha_hora(resultados_proyecto, "NDH", "NDNH"))
    else:
        faltantes.append("Fecha y hora de monitoreo (nocturno)")

    # --- Resumen LRAeq +/- incertidumbre (Diurno / Nocturno) ---
    total_verificaciones += 2
    _, t_resumen_dia = encontrar_tabla(
        doc, requeridos=["diurno", "incert"], excluidos=["nocturno"], filas_encabezado=2
    )
    if t_resumen_dia is not None:
        escribir_filas(t_resumen_dia, 2, _filas_resumen_lraeq(resultados_proyecto, "DH", "DNH"))
    else:
        faltantes.append("Resumen LRAeq diurno")

    _, t_resumen_noche = encontrar_tabla(
        doc, requeridos=["nocturno", "incert"], excluidos=["diurno"], filas_encabezado=2
    )
    if t_resumen_noche is not None:
        escribir_filas(t_resumen_noche, 2, _filas_resumen_lraeq(resultados_proyecto, "NDH", "NDNH"))
    else:
        faltantes.append("Resumen LRAeq nocturno")

    # --- Detalle por direccion (DH, DNH, NDH, NDNH) ---
    total_verificaciones += len(ESQUEMAS)
    detalle = encontrar_tablas(doc, requeridos=["medidor 1", "correccion"], filas_encabezado=3)
    for (idx, tabla), esquema in zip(detalle, ESQUEMAS):
        escribir_filas(tabla, 3, _filas_detalle(resultados_proyecto, esquema))
    for esquema in ESQUEMAS[len(detalle):]:
        faltantes.append(f"Detalle por direccion ({esquema})")

    # --- Comparacion con la norma (Diurno / Nocturno) ---
    total_verificaciones += 2
    _, t_cmp_dia = encontrar_tabla(
        doc, requeridos=["resultados de monitoreo", "diurno"], excluidos=["nocturno"], filas_encabezado=2
    )
    if t_cmp_dia is not None:
        escribir_filas(t_cmp_dia, 2, _filas_comparacion(resultados_proyecto, "diurno"))
    else:
        faltantes.append("Comparacion con la norma (diurno)")

    _, t_cmp_noche = encontrar_tabla(
        doc, requeridos=["resultados de monitoreo", "nocturno"], excluidos=["diurno"], filas_encabezado=2
    )
    if t_cmp_noche is not None:
        escribir_filas(t_cmp_noche, 2, _filas_comparacion(resultados_proyecto, "nocturno"))
    else:
        faltantes.append("Comparacion con la norma (nocturno)")

    # --- Graficas de resultados ---
    if graficas.get("diurno"):
        insertar_imagen_despues_de(doc, "Jornada Diurna", graficas["diurno"], ancho_emu=5000000)
    if graficas.get("nocturno"):
        insertar_imagen_despues_de(doc, "Jornada Nocturna", graficas["nocturno"], ancho_emu=5000000)

    # --- Mapas de isofonas (uno por esquema: DH, DNH, NDH, NDNH) ---
    # Cada llamada coloca su contenido inmediatamente despues del heading,
    # asi que se recorren en orden inverso al deseado para que el resultado
    # final quede DH, DNH, NDH, NDNH de arriba hacia abajo.
    isofonas = isofonas or {}
    for esquema in reversed(ESQUEMAS):
        if isofonas.get(esquema):
            insertar_imagen_despues_de(doc, "Mapas de Isofonas", isofonas[esquema], ancho_emu=5400000)
            insertar_texto_despues_de(doc, "Mapas de Isofonas", ESQUEMA_LABELS[esquema], negrita=True)

    # --- Mapa de localizacion de los puntos (Imagen 1) ---
    faltantes_textos_extra = []
    if graficas.get("localizacion") and not _reemplazar_imagen_tras_leyenda(
            doc, ("imagen", "localizacion"), graficas["localizacion"]):
        faltantes_textos_extra.append("Imagen de localización de los puntos (leyenda 'Imagen 1. Localización')")

    # --- Textos: portada, encabezado, resumen, objetivos, cliente, analisis, conclusiones ---
    from .informe_textos import aplicar_textos

    faltantes_textos = aplicar_textos(doc, resultados_proyecto, filas_equipos, hoy=hoy) + faltantes_textos_extra

    faltantes_meteo = []
    if meteo is None:
        faltantes_meteo.append("Capítulo de meteorología: no hay datos de la estación meteorológica para los días "
                               "de medición; quedó el texto de la plantilla")
    else:
        from .meteo_informe import aplicar_meteorologia

        analisis_meteo, graficas_meteo = meteo
        faltantes_meteo = aplicar_meteorologia(doc, analisis_meteo, graficas_meteo)

    doc.save(ruta_salida)

    if len(faltantes) == total_verificaciones:
        raise ErrorPlantilla(
            "La plantilla no contiene ninguna de las tablas esperadas (Fecha y hora, "
            "Detalle por direccion, Resumen LRAeq, Comparacion con la norma).\n\n"
            "Verifique que sea un documento con la misma estructura de tablas que "
            "'templates/informe_template.docx', y no un documento en blanco."
        )

    return ruta_salida, faltantes + faltantes_textos + faltantes_meteo
