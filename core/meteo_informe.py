"""Llena el capitulo METEOROLOGIA del informe Word con el analisis de
core/meteorologia.py: tabla de datos diarios, parrafos de cada variable y
graficas (temperatura, humedad, presion y viento)."""
from __future__ import annotations

from docx.text.paragraph import Paragraph

from .docx_utils import _sin_tildes, blips, encontrar_tabla, escribir_filas, reemplazar_imagen, set_paragraph_text
from .meteorologia import filas_tabla_diaria

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
    ("viento", ["clases_viento", "rosa_vientos"]),
]


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


def aplicar_meteorologia(doc, analisis, graficas: dict) -> list:
    """Devuelve la lista de partes que no se encontraron en la plantilla."""
    faltantes = []
    capitulo = _capitulo(doc)
    if not capitulo:
        return ["Capitulo de meteorologia (titulo 'METEOROLOGIA')"]

    _, tabla = encontrar_tabla(doc, ["fecha de monitoreo", "temperatura", "humedad"], filas_encabezado=1)
    if tabla is not None:
        escribir_filas(tabla, 1, filas_tabla_diaria(analisis))
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
        set_paragraph_text(destino, analisis.textos[clave])

    for palabra, claves in _GRAFICAS:
        idx = next((i for i, el in enumerate(capitulo) if el.tag == f"{_W}p"
                    and _estilo(Paragraph(el, doc)).startswith("Caption")
                    and _sin_tildes(Paragraph(el, doc).text).startswith("grafica")
                    and palabra in _sin_tildes(Paragraph(el, doc).text)), None)
        if idx is None:
            faltantes.append(f"Grafica de {palabra} en meteorologia")
            continue
        encontrados = []
        for el in capitulo[idx + 1: idx + 5]:
            encontrados.extend(blips(el))
            if len(encontrados) >= len(claves):
                break
        for blip, clave in zip(encontrados, claves):
            if graficas.get(clave):
                reemplazar_imagen(doc, blip, graficas[clave])
        if len(encontrados) < len(claves):
            faltantes.append(f"Imagen de la grafica de {palabra} en meteorologia")
    return faltantes
