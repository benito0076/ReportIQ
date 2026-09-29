"""Llena el capitulo METEOROLOGIA del informe Word con el analisis de
core/meteorologia.py: tabla de datos diarios, parrafos de cada variable y
graficas (temperatura, humedad, presion y viento)."""
from __future__ import annotations

import re

from docx.text.paragraph import Paragraph

from .docx_utils import _sin_tildes, blips, encontrar_tabla, reconstruir_filas, reemplazar_imagen, set_paragraph_text
from .meteorologia import filas_frecuencia_direcciones, filas_tabla_diaria

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# Subtitulo (Heading 2) -> clave del texto generado.
_SECCIONES = [
    ("temperatura ambiente", "temperatura"),
    ("humedad relativa", "humedad"),
    ("presion atmosferica", "presion"),
    ("precipitacion", "precipitacion"),
    ("velocidad y direccion del viento", "viento"),
]
# Titulo de la grafica -> claves de las imagenes, en el orden en que aparecen.
_GRAFICAS = [
    ("temperatura", ["temperatura"]),
    ("humedad", ["humedad"]),
    ("presion", ["presion"]),
    ("precipitacion", ["lluvia"]),  # solo en algunas plantillas (emision)
    ("viento", ["viento_combinado"]),
]
_GRAFICAS_OPCIONALES = {"precipitacion"}


def _estilo(p: Paragraph) -> str:
    try:
        return p.style.name or ""
    except Exception:  # noqa: BLE001
        return ""


def _capitulo(doc):
    """Elementos del cuerpo (parrafos y tablas) del capitulo METEOROLOGIA."""
    elementos = [el for el in doc.element.body.iterchildren() if el.tag in (f"{_W}p", f"{_W}tbl")]
    inicio = fin = None
    for i, el in enumerate(elementos):
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        if not _estilo(p).startswith("Heading 1"):
            continue
        if inicio is None and "meteorolog" in _sin_tildes(p.text):
            inicio = i
        elif inicio is not None:
            fin = i
            break
    if inicio is None:
        return []
    return elementos[inicio:fin]


_WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"


def _grafica_viento(doc, elementos, blips_encontrados, graficas, analisis):
    """La grafica de viento de las plantillas es un grupo flotante con dos
    imagenes (rosa y clases): se cambia el grupo completo por una imagen en
    linea con ambas, del mismo ancho, y se llena la tabla de porcentajes por
    direccion que la acompana."""
    from docx.shared import Emu
    from docx.table import Table

    from .docx_utils import escribir_filas

    ruta = graficas.get("viento_combinado")
    if ruta and blips_encontrados:
        dibujo = blips_encontrados[0]
        while dibujo is not None and dibujo.tag != f"{_W}drawing":
            dibujo = dibujo.getparent()
        if dibujo is not None:
            extent = next(dibujo.iter(f"{_WP}extent"), None)
            ancho = int(extent.get("cx")) if extent is not None else None
            # El dibujo suele estar dentro de mc:AlternateContent (con una version
            # VML de respaldo): se quita todo el contenido alternativo del run.
            hijo, run_el = dibujo, dibujo.getparent()
            while run_el is not None and run_el.tag != f"{_W}r":
                hijo, run_el = run_el, run_el.getparent()
            if run_el is not None:
                parrafo_el = run_el.getparent()
                run_el.remove(hijo)
                Paragraph(parrafo_el, doc).add_run().add_picture(ruta, width=Emu(ancho) if ancho else None)
    for el in elementos:
        if el.tag != f"{_W}tbl":
            continue
        for anidada in el.iter(f"{_W}tbl"):
            if anidada is el:
                continue
            tabla = Table(anidada, doc)
            encabezado = _sin_tildes(" ".join(c.text for c in tabla.rows[0].cells))
            if "direccion" in encabezado and "porcentaje" in encabezado:
                escribir_filas(tabla, 1, filas_frecuencia_direcciones(analisis))
                return


def _numero_grafica(doc, capitulo, palabra):
    for el in capitulo:
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        texto = _sin_tildes(p.text)
        if _estilo(p).startswith("Caption") and texto.startswith("grafica") and palabra in texto:
            m = re.match(r"\s*gr[aá]fica\s+(\d+)", texto)
            return m.group(1) if m else None
    return None


def aplicar_meteorologia(doc, analisis, graficas: dict) -> list:
    """Devuelve la lista de partes que no se encontraron en la plantilla."""
    faltantes = []
    capitulo = _capitulo(doc)
    if not capitulo:
        return ["Capitulo de meteorologia (titulo 'METEOROLOGIA')"]

    _, tabla = encontrar_tabla(doc, ["fecha de monitoreo", "temperatura", "humedad"], filas_encabezado=1)
    if tabla is not None:
        reconstruir_filas(tabla, 1, filas_tabla_diaria(analisis),
                          es_resumen=lambda v: _sin_tildes(str(v[0]).strip()) in ("promedio", "maximo", "minimo"))
    else:
        faltantes.append("Tabla de datos meteorologicos")

    parrafos = [(i, Paragraph(el, doc)) for i, el in enumerate(capitulo) if el.tag == f"{_W}p"]

    # Parrafo introductorio: ya no se usa WRPLOT, la rosa la genera la aplicacion.
    for _, p in parrafos:
        if "wrplot" in _sin_tildes(p.text):
            texto = p.text
            corte = texto.lower().find("por otro lado")
            base = texto[:corte].rstrip() if corte > 0 else texto
            set_paragraph_text(p, base + " Por otro lado, la rosa de los vientos se elabora a partir de los "
                                      "registros horarios de la estación meteorológica durante los días de monitoreo.")
            break

    for titulo, clave in _SECCIONES:
        pos = next((k for k, (_, p) in enumerate(parrafos)
                    if _estilo(p).startswith("Heading 2") and titulo in _sin_tildes(p.text)), None)
        if pos is None:
            faltantes.append(f"Seccion '{titulo}' de meteorologia")
            continue
        destino = next((p for _, p in parrafos[pos + 1:]
                        if p.text.strip() and not _estilo(p).startswith(("Heading", "Caption"))
                        and not _sin_tildes(p.text).startswith("fuente")), None)
        if destino is None or _estilo(destino).startswith("Heading"):
            faltantes.append(f"Parrafo de '{titulo}' en meteorologia")
            continue
        texto = analisis.textos[clave]
        if clave == "viento":
            # El numero de la grafica de viento cambia segun la plantilla (4 en
            # ambiental, 5 en emision, que tiene grafica de precipitacion).
            numero = _numero_grafica(doc, capitulo, "viento")
            if numero:
                texto = re.sub(r"Gráfica \d+", f"Gráfica {numero}", texto)
        set_paragraph_text(destino, texto)
        if clave == "precipitacion":
            # Parrafos adicionales de la plantilla sobre la lluvia: el texto generado ya lo cubre.
            fin = next((k for k, (_, p) in enumerate(parrafos) if k > pos and _estilo(p).startswith("Heading")),
                       len(parrafos))
            for _, extra in parrafos[pos + 1:fin]:
                if extra is not destino and extra.text.strip() and len(extra.text.strip()) > 1 \
                        and not _estilo(extra).startswith("Caption") \
                        and not _sin_tildes(extra.text).strip().startswith("fuente"):
                    extra._element.getparent().remove(extra._element)
        if clave == "viento" and analisis.textos.get("viento_mediciones"):
            # Segundo parrafo: condicion de viento < 3 m/s durante las mediciones.
            siguiente = next((p for _, p in parrafos[pos + 1:] if p is not destino and "3 m/s" in p.text), None)
            if siguiente is not None:
                set_paragraph_text(siguiente, analisis.textos["viento_mediciones"])

    for palabra, claves in _GRAFICAS:
        idx = next((i for i, el in enumerate(capitulo) if el.tag == f"{_W}p"
                    and _estilo(Paragraph(el, doc)).startswith("Caption")
                    and _sin_tildes(Paragraph(el, doc).text).startswith("grafica")
                    and palabra in _sin_tildes(Paragraph(el, doc).text)), None)
        if idx is None:
            if palabra not in _GRAFICAS_OPCIONALES:
                faltantes.append(f"Grafica de {palabra} en meteorologia")
            continue
        encontrados = []
        for el in capitulo[idx + 1: idx + 5]:
            encontrados.extend(blips(el))
            if len(encontrados) >= len(claves):
                break
        if palabra == "viento":
            _grafica_viento(doc, capitulo[idx + 1: idx + 5], encontrados, graficas, analisis)
            continue
        for blip, clave in zip(encontrados, claves):
            if graficas.get(clave):
                reemplazar_imagen(doc, blip, graficas[clave])
        if len(encontrados) < len(claves):
            faltantes.append(f"Imagen de la grafica de {palabra} en meteorologia")
    return faltantes
