"""Redacta las partes del informe Word que dependen del proyecto y de los
resultados, para que el documento salga completo sin editarlo a mano:

- portada, encabezado y cuadro de control (version, fechas, firmas);
- resumen, objetivos, informacion del cliente y condiciones del area;
- tiempos de medicion, incertidumbre y numero de jornadas;
- tabla de estandares de la Res. 0627 (resalta el sector de los puntos);
- descripcion de las fuentes de ruido, analisis de resultados y conclusiones;
- ano de las lineas "Fuente: ..." y actualizacion de indices al abrir.

Cada parte se ubica por el texto de su titulo o de su propio parrafo, de modo
que una plantilla propia con la misma redaccion base tambien funciona. Lo que
no se encuentra se informa en la lista de faltantes, sin detener el informe."""
from __future__ import annotations

import copy
import datetime as dt
import re
from collections import Counter

from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

from . import norms
from .docx_utils import _sin_tildes, encontrar_tabla, set_cell_text, set_paragraph_text
from .models import ESQUEMAS

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

_UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
             "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho",
             "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
             "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
_DECENAS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta",
            9: "noventa"}

TIPO_DIA = {"DH": "hábil", "DNH": "no hábil", "NDH": "hábil", "NDNH": "no hábil"}
JORNADA = {"DH": "diurno", "DNH": "diurno", "NDH": "nocturno", "NDNH": "nocturno"}
ESQUEMAS_JORNADA = {"diurno": ("DH", "DNH"), "nocturno": ("NDH", "NDNH")}

NOMBRE_SECTOR = {
    "A": "Tranquilidad y Silencio",
    "B": "Tranquilidad y Ruido Moderado",
    "C": "Ruido Intermedio Restringido",
    "D": "Zona Suburbana o Rural de Tranquilidad y Ruido Moderado",
}
# Las etiquetas de core/norms.py no llevan tildes; para el texto del informe se corrigen.
_TILDES = {
    "guarderias": "guarderías", "geriatricos": "geriátricos", "hoteleria": "hotelería",
    "investigacion": "investigación", "mecanicos": "mecánicos", "mecanica": "mecánica",
    "areas": "áreas", "espectaculos": "espectáculos", "publicos": "públicos", "vias": "vías",
    "explotacion": "explotación", "recreacion": "recreación", "Rural Habitada": "Rural habitada",
}

COLOR_RESALTADO = "D9D9D9"


# ----------------------------------------------------------------- redaccion
def numero_en_letras(n: int) -> str:
    if 0 <= n < len(_UNIDADES):
        return _UNIDADES[n]
    if n < 100:
        decena, unidad = divmod(n, 10)
        return _DECENAS[decena] + (f" y {_UNIDADES[unidad]}" if unidad else "")
    return str(n)


def cantidad(n: int, singular: str, plural: str) -> str:
    """cantidad(5, 'punto', 'puntos') -> 'cinco (5) puntos'; con 1 -> 'un (1) punto'."""
    if n == 1:
        return f"un (1) {singular}"
    return f"{numero_en_letras(n)} ({n}) {plural}"


def lista(items) -> str:
    items = [str(i) for i in items]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " y " + items[-1]


def fmt_db(v) -> str:
    return f"{v:.1f}".replace(".", ",")


def fmt_num(v) -> str:
    """Numero sin decimales innecesarios, con coma decimal (55 -> '55', 0.0043 -> '0,0043')."""
    texto = f"{v:.4f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def texto_dias(fechas) -> str:
    """{28/06, 29/06, 30/06/2026} -> 'los días 28, 29 y 30 de junio de 2026'."""
    fechas = sorted(set(fechas))
    if not fechas:
        return ""
    grupos = []  # [(anio, mes, [dias])]
    for f in fechas:
        if grupos and grupos[-1][0] == f.year and grupos[-1][1] == f.month:
            grupos[-1][2].append(f.day)
        else:
            grupos.append((f.year, f.month, [f.day]))
    partes = []
    for i, (anio, mes, dias) in enumerate(grupos):
        texto = f"{lista(dias)} de {MESES[mes - 1]}"
        if i == len(grupos) - 1 or grupos[i + 1][0] != anio:
            texto += f" de {anio}"
        partes.append(texto)
    prefijo = "el día" if len(fechas) == 1 else "los días"
    return f"{prefijo} {lista(partes)}"


def _corregir_tildes(texto: str) -> str:
    for sin, con in _TILDES.items():
        texto = re.sub(rf"\b{re.escape(sin)}\b", con, texto)
    return texto


def describir_sector(etiqueta: str):
    """'D - Zona suburbana ... - Rural Habitada ...' -> (texto del sector, SectorNorma)."""
    s = norms.buscar_sector(etiqueta)
    if s is None:
        return None, None
    partes = s.subsector.split(" - ", 1)
    subsector = _corregir_tildes(partes[1] if len(partes) > 1 else partes[0]).rstrip(". ")
    nombre = NOMBRE_SECTOR.get(s.sector, _corregir_tildes(partes[0]))
    return f"Sector {s.sector}. {nombre}, Subsector: {subsector}", s


class Contexto:
    """Datos del proyecto y de los resultados que se reutilizan en los textos."""

    def __init__(self, resultados, filas_equipos=None, hoy: dt.date | None = None):
        self.res = resultados
        self.proyecto = resultados.proyecto
        self.datos = self.proyecto.informe
        self.puntos = list(self.proyecto.puntos)
        self.n = len(self.puntos)
        self.filas_equipos = filas_equipos or []
        self.fecha = _fecha_iso(self.datos.fecha) or hoy or dt.date.today()
        self.esquemas = [e for e in ESQUEMAS
                         if any(e in self.res.por_punto.get(p.no_punto, {}) for p in self.puntos)]
        self.fechas_medicion = sorted({
            f.date() for por_esquema in self.res.por_punto.values() for rp in por_esquema.values()
            for f in (rp.inicio, rp.fin) if isinstance(f, dt.datetime)
        })
        grupos = {}
        for p in self.puntos:
            if norms.buscar_sector(p.sector):
                grupos.setdefault(p.sector, []).append(p.nombre)
        self.sectores = grupos  # etiqueta -> [nombres de puntos]

    # --- frases reutilizables
    @property
    def area(self) -> str:
        area = (self.datos.area_estudio or "").strip().rstrip(".")
        if area:
            return area
        nombre = self.proyecto.nombre_proyecto.strip()
        return f"el área del proyecto {nombre}" if nombre else "el área de estudio"

    @property
    def cliente(self) -> str:
        return self.proyecto.cliente.strip()

    def los_puntos(self) -> str:
        return "el punto" if self.n == 1 else f"los {cantidad(self.n, 'punto', 'puntos')}"

    def jornadas(self) -> str:
        j = [x for x, e in (("diurna", ("DH", "DNH")), ("nocturna", ("NDH", "NDNH")))
             if any(k in self.esquemas for k in e)]
        return "las jornadas diurna y nocturna" if len(j) == 2 else f"la jornada {j[0]}" if j else "las jornadas evaluadas"

    def tipos_dia(self, estilo="tanto") -> str:
        h = any(e in self.esquemas for e in ("DH", "NDH"))
        nh = any(e in self.esquemas for e in ("DNH", "NDNH"))
        if h and nh:
            return "tanto en días hábiles como no hábiles" if estilo == "tanto" else "día hábil y día no hábil"
        if h:
            return "en día hábil" if estilo == "tanto" else "día hábil"
        if nh:
            return "en día no hábil" if estilo == "tanto" else "día no hábil"
        return ""

    def texto_sectores(self, limites="límite") -> str:
        """Sector(es) y estandares con que se comparan los resultados."""
        partes = []
        for etiqueta, nombres in self.sectores.items():
            texto, s = describir_sector(etiqueta)
            if limites == "límite":
                lim = (f"con un límite máximo de ruido ambiental de {s.dia} dB(A) para jornada diurna "
                       f"y {s.noche} dB(A) para jornada nocturna")
            else:
                lim = (f"con un estándar máximo permisible de nivel de ruido ambiental de {s.dia} dB(A) "
                       f"en periodo diurno y {s.noche} dB(A) en periodo nocturno")
            if len(self.sectores) > 1:
                texto += f" ({'punto' if len(nombres) == 1 else 'puntos'} {lista(nombres)})"
            partes.append(f"{texto}, {lim}")
        return "; ".join(partes)


def _con_punto(texto: str) -> str:
    """Agrega el punto final sin duplicarlo ('... Ecopetrol S.A.' no queda con '..')."""
    return texto if texto.endswith(".") else texto + "."


def _fecha_iso(texto) -> dt.date | None:
    try:
        return dt.date.fromisoformat(str(texto).strip()[:10])
    except ValueError:
        return None


# ------------------------------------------------------ analisis de resultados
def _niveles(ctx: Contexto, esquema: str):
    """[(nombre, nivel, estandar)] de los puntos con resultado en el esquema."""
    salida = []
    for p in ctx.puntos:
        rc = ctx.res.comparacion.get(p.no_punto)
        if rc is None:
            continue
        nivel = getattr(rc, f"lraeq_{esquema.lower()}")
        est = rc.estandar_diurno if JORNADA[esquema] == "diurno" else rc.estandar_nocturno
        if nivel is not None:
            salida.append((p.nombre, nivel, est))
    return salida


def _supera(nivel, est) -> bool:
    return norms.cumple(nivel, est) == "No"


def textos_jornada(ctx: Contexto, jornada: str) -> list[str]:
    """Parrafos del analisis de una jornada ('diurno' o 'nocturno')."""
    esquemas = [e for e in ESQUEMAS_JORNADA[jornada] if _niveles(ctx, e)]
    if not esquemas:
        return [f"No se cuenta con resultados de la jornada {jornada[:-1]}a."]
    nombre_j = "diurna" if jornada == "diurno" else "nocturna"
    comparables = [(n, v, est, e) for e in esquemas for n, v, est in _niveles(ctx, e) if est is not None]
    estandares = sorted({est for _, _, est, _ in comparables})
    if len(estandares) == 1:
        ref, este = f"el estándar máximo permisible de {fmt_num(estandares[0])} dB(A)", "este valor"
    else:
        ref, este = "el estándar máximo permisible del sector asignado a cada punto", "dicho estándar"
    tipos = (f"tanto en jornada {nombre_j} hábil como no hábil" if len(esquemas) == 2
             else f"en jornada {nombre_j} {TIPO_DIA[esquemas[0]]}")
    puntos_eval = sorted({n for n, *_ in comparables}, key=[p.nombre for p in ctx.puntos].index)
    sujeto = (f"los valores obtenidos en los {numero_en_letras(len(puntos_eval))} puntos"
              if len(puntos_eval) > 1 else f"el valor obtenido en {puntos_eval[0]}" if puntos_eval else "")

    superan = [c for c in comparables if _supera(c[1], c[2])]
    parrafos = []
    if not comparables:
        parrafos.append("Los puntos no tienen un sector asignado, por lo que no se realizó la comparación "
                        "con los estándares máximos permisibles de la Resolución 0627 de 2006.")
        cierre = ""
    elif len(superan) == len(comparables):
        verbo = "se ubicaron" if len(puntos_eval) > 1 else "se ubicó"
        parrafos.append(f"Al comparar los resultados con {ref}, se encontró que {sujeto} {verbo} por encima "
                        f"de {este} {tipos}.")
        cierre = ("De acuerdo con la comparación realizada, todos los resultados fueron reportados por encima "
                  "del estándar establecido para las jornadas evaluadas.")
    elif not superan:
        verbo = "se ubicaron" if len(puntos_eval) > 1 else "se ubicó"
        parrafos.append(f"Al comparar los resultados con {ref}, se encontró que {sujeto} {verbo} por debajo "
                        f"de {este} {tipos}.")
        cierre = ("De acuerdo con la comparación realizada, todos los resultados presentan cumplimiento "
                  "normativo para las jornadas evaluadas.")
    else:
        detalle = lista(f"{n} en día {TIPO_DIA[e]} ({fmt_db(v)} dB(A))" for n, v, _, e in superan)
        parrafos.append(f"Al comparar los resultados con {ref}, se encontró que {len(superan)} de los "
                        f"{len(comparables)} resultados superaron {este}: {detalle}. Los demás resultados "
                        f"se ubicaron por debajo del estándar y presentan cumplimiento normativo.")
        cierre = ""

    frases = []
    for i, e in enumerate(esquemas):
        valores = _niveles(ctx, e)
        tipo = TIPO_DIA[e]
        if len(valores) == 1:
            n, v, _ = valores[0]
            texto = f"en la jornada {tipo} se obtuvo un nivel de {fmt_db(v)} dB(A) en {n}"
        else:
            bajo = min(valores, key=lambda x: x[1])
            alto = max(valores, key=lambda x: x[1])
            if i == 0:
                texto = (f"en la jornada {tipo}, los resultados estuvieron entre {fmt_db(bajo[1])} dB(A), "
                         f"registrado en {bajo[0]}, y {fmt_db(alto[1])} dB(A), obtenido en {alto[0]}")
            else:
                texto = (f"en la jornada {tipo}, oscilaron entre {fmt_db(bajo[1])} dB(A) en {bajo[0]} "
                         f"y {fmt_db(alto[1])} dB(A) en {alto[0]}")
        frases.append(texto)
    rango = frases[0][0].upper() + frases[0][1:]
    if len(frases) > 1:
        rango += "; mientras que, " + frases[1]
    rango += "."

    if len(esquemas) == 2:
        h = {n: v for n, v, _ in _niveles(ctx, esquemas[0])}
        nh = {n: v for n, v, _ in _niveles(ctx, esquemas[1])}
        ambos = [p.nombre for p in ctx.puntos if p.nombre in h and p.nombre in nh]
        mayor_h = [n for n in ambos if round(h[n], 1) > round(nh[n], 1)]
        mayor_nh = [n for n in ambos if round(nh[n], 1) > round(h[n], 1)]
        iguales = [n for n in ambos if round(h[n], 1) == round(nh[n], 1)]
        comparacion = []
        if mayor_h and mayor_nh:
            comparacion.append(f"En {lista(mayor_h)} se registraron niveles más altos durante la jornada hábil, "
                               f"mientras que en {lista(mayor_nh)} los valores más altos correspondieron a la "
                               f"jornada no hábil.")
        elif mayor_h:
            sujeto_h = "todos los puntos" if len(mayor_h) == len(ambos) > 1 else lista(mayor_h)
            comparacion.append(f"En {sujeto_h} se registraron niveles más altos durante la jornada hábil.")
        elif mayor_nh:
            sujeto_nh = "todos los puntos" if len(mayor_nh) == len(ambos) > 1 else lista(mayor_nh)
            comparacion.append(f"En {sujeto_nh} se registraron niveles más altos durante la jornada no hábil.")
        if iguales:
            comparacion.append(f"En {lista(iguales)} se obtuvo el mismo nivel en ambas jornadas.")
        rango += " " + " ".join(comparacion) if comparacion else ""
    if cierre:
        rango += " " + cierre
    parrafos.append(rango)
    return parrafos


def resumen_cumplimiento(ctx: Contexto) -> str:
    """Conclusion general: cumplimiento y niveles mas alto / mas bajo por periodo."""
    comparables = [(n, v, est, e) for e in ctx.esquemas for n, v, est in _niveles(ctx, e) if est is not None]
    superan = [c for c in comparables if _supera(c[1], c[2])]
    periodos = " y ".join(dict.fromkeys(("diurno" if e in ("DH", "DNH") else "nocturno") for e in ctx.esquemas))
    if not comparables:
        general = ("De manera general, no se realizó la comparación normativa porque los puntos no tienen un "
                   "sector asignado")
    elif len(superan) == len(comparables):
        general = (f"De manera general, todos los resultados se ubicaron por encima de los estándares "
                   f"establecidos para {'los periodos' if ' y ' in periodos else 'el periodo'} {periodos}")
    elif not superan:
        general = (f"De manera general, todos los resultados se ubicaron por debajo de los estándares "
                   f"establecidos para {'los periodos' if ' y ' in periodos else 'el periodo'} {periodos}, "
                   f"presentando cumplimiento normativo")
    else:
        detalle = lista(f"{n} en periodo {JORNADA[e]} {TIPO_DIA[e]}" for n, _, _, e in superan)
        general = (f"De manera general, {len(superan)} de los {len(comparables)} resultados superaron los "
                   f"estándares establecidos ({detalle}); los demás presentaron cumplimiento normativo")
    extremos = []
    for e in ctx.esquemas:
        valores = _niveles(ctx, e)
        if len(valores) < 2:
            continue
        alto = max(valores, key=lambda x: x[1])[0]
        bajo = min(valores, key=lambda x: x[1])[0]
        extremos.append(f"en el periodo {JORNADA[e]} {TIPO_DIA[e]}, el nivel más alto se registró en {alto} "
                        f"y el más bajo en {bajo}")
    texto = general + "."
    if extremos:
        texto += " " + extremos[0][0].upper() + extremos[0][1:]
        if len(extremos) > 1:
            texto += "; " + "; ".join(extremos[1:])
        texto += "."
    return texto


# Palabras clave de las fuentes de ruido para la conclusion (se ignoran las
# frases negativas: "no se registraron actividades constructivas").
_FUENTES = [
    ("la fauna local (aves, insectos y otros animales)",
     r"\baves?\b|grillo|insecto|rana|perro|chicharra|fauna|animal|gallo"),
    ("el tránsito de vehículos y motocicletas", r"veh[ií]cul|moto|tr[aá]nsito|tr[aá]fico|carro|cami[oó]n|\bbus"),
    ("el paso y pastoreo de ganado", r"ganad|pastoreo|vacas?\b|bovino"),
    ("el flujo de agua de ríos y quebradas", r"\br[ií]os?\b|quebrada|cascada|corriente de agua"),
    ("el sonido de la vegetación y el viento", r"vegetaci|[aá]rbol|hojas|viento"),
    ("actividades humanas como conversaciones y música",
     r"conversaci|m[uú]sica|personas|voces|habitantes|gritos"),
    ("maquinaria y equipos industriales", r"maquinaria|planta|industri|compresor|generador|bomba|motor(es)?\b"),
    ("actividades de construcción", r"construcci|\bobras?\b"),
    ("el paso de aeronaves", r"avi[oó]n|aeronave|helic[oó]ptero|avioneta"),
]
_NEGACION = re.compile(r"\bno se\b|\bsin\b|\bning[uú]n|\bnunca\b|\bni\b", re.I)


def fuentes_frecuentes(puntos) -> list[str]:
    conteo = Counter()
    for p in puntos:
        frases = [f for f in re.split(r"[.;]", p.fuentes or "") if f.strip() and not _NEGACION.search(f)]
        for nombre, patron in _FUENTES:
            if any(re.search(patron, f, re.I) for f in frases):
                conteo[nombre] += 1
    orden = [nombre for nombre, _ in _FUENTES]
    return sorted(conteo, key=lambda k: (-conteo[k], orden.index(k)))


def conclusion_fuentes(ctx: Contexto) -> str:
    frecuentes = fuentes_frecuentes(ctx.puntos)
    if not frecuentes:
        return ("Las fuentes generadoras de ruido identificadas en cada punto de monitoreo se describen en el "
                "capítulo de descripción de las fuentes generadoras de ruido y en el Anexo 4. Registros de campo.")
    texto = ("En términos generales, el ambiente acústico de los puntos evaluados estuvo determinado por "
             f"{lista(frecuentes[:5])}")
    return (texto + ". Estas fuentes se presentaron de forma variable según el punto, la orientación del "
            "micrófono y el periodo de medición.")


# ----------------------------------------------------- navegacion del documento
def _estilo(p: Paragraph) -> str:
    try:
        return p.style.name or ""
    except Exception:  # noqa: BLE001
        return ""


def _nivel_titulo(p: Paragraph):
    m = re.match(r"Heading (\d)", _estilo(p))
    return int(m.group(1)) if m else None


def _cuerpo(doc):
    return [el for el in doc.element.body.iterchildren() if el.tag in (f"{_W}p", f"{_W}tbl")]


def seccion(doc, titulo: str, nivel: int):
    """Elementos (parrafos y tablas) bajo el titulo de nivel `nivel` cuyo texto
    contiene `titulo`, hasta el siguiente titulo de igual o mayor jerarquia."""
    elementos = _cuerpo(doc)
    inicio = None
    for i, el in enumerate(elementos):
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        nv = _nivel_titulo(p)
        if nv is None:
            continue
        if inicio is None:
            if nv == nivel and titulo in _sin_tildes(p.text):
                inicio = i
        elif nv <= nivel:
            return elementos[inicio + 1:i]
    return elementos[inicio + 1:] if inicio is not None else None


def parrafos_texto(doc, elementos):
    """Parrafos de texto corrido (sin titulos, leyendas, 'Fuente:' ni vacios)."""
    salida = []
    for el in elementos or []:
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        estilo = _estilo(p)
        texto = _sin_tildes(p.text.strip())
        if not texto or estilo.startswith(("Heading", "Caption", "toc", "Fuente")) or texto.startswith("fuente"):
            continue
        salida.append(p)
    return salida


def _buscar(parrafos, *fragmentos):
    for p in parrafos:
        t = _sin_tildes(p.text)
        if all(f in t for f in fragmentos):
            return p
    return None


def _referencia(texto: str, patron: str, defecto: str) -> str:
    m = re.search(patron, texto)
    return m.group(0) if m else defecto


def _escribir_parrafos(parrafos, textos):
    """Escribe `textos` en los parrafos existentes (copiando el formato del
    primero si hacen falta mas) y elimina los que sobran."""
    if not parrafos:
        return
    modelo = parrafos[0]
    anterior = parrafos[-1]._element
    for i, texto in enumerate(textos):
        if i < len(parrafos):
            set_paragraph_text(parrafos[i], texto)
        else:
            nuevo = copy.deepcopy(modelo._element)
            anterior.addnext(nuevo)
            anterior = nuevo
            set_paragraph_text(Paragraph(nuevo, modelo._parent), texto)
    for p in parrafos[len(textos):]:
        p._element.getparent().remove(p._element)


# ------------------------------------------------------------------- secciones
def _resumen(doc, ctx: Contexto, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "resumen", 1))
    if not parrafos:
        faltantes.append("Resumen (titulo 'RESUMEN')")
        return
    p = _buscar(parrafos, "presente estudio")
    if p is not None:
        if ctx.n == 1:
            puntos = "se monitoreó un (1) punto, el cual se encuentra ubicado"
        else:
            puntos = f"se monitorearon {cantidad(ctx.n, 'punto', 'puntos')}, los cuales se encuentran ubicados"
        ubic = _ubicacion(ctx)
        texto = (f"El presente estudio determina los niveles de presión sonora de ruido ambiental que se "
                 f"presentan actualmente en {ctx.area}; para el logro de este objetivo ")
        texto += f"{puntos} {ubic}." if ubic else f"{puntos.split(',')[0]}."
        set_paragraph_text(p, texto)
    p = _buscar(parrafos, "mediciones de ruido ambiental se realizaron")
    if p is not None and ctx.fechas_medicion:
        original = p.text
        corte = original.find("Cada medici")
        resto = " " + original[corte:] if corte > 0 else ""
        set_paragraph_text(p, f"Las mediciones de ruido ambiental se realizaron {texto_dias(ctx.fechas_medicion)}, "
                              f"abarcando {ctx.jornadas()}, {ctx.tipos_dia()}.{resto}")
    p = _buscar(parrafos, "articulo 17")
    if p is not None and ctx.sectores:
        tabla = _referencia(p.text, r"Tabla \d+", "Tabla 2")
        comparacion = (f"con el {ctx.texto_sectores()}" if len(ctx.sectores) == 1
                       else f"con el sector asignado a cada punto: {ctx.texto_sectores()}")
        set_paragraph_text(p, "De acuerdo con la Resolución anteriormente mencionada el Capítulo III, Artículo 17 "
                              "establece los estándares máximos permisibles de niveles de ruido ambiental según "
                              "la clasificación del sector en donde se realice la medición. Dichos valores se "
                              f"consignan en la {tabla}, la cual se tomó en cuenta para clasificar los puntos de "
                              "medición, por lo tanto, se realiza la respectiva comparación de los resultados "
                              f"obtenidos {comparacion}.")
    p = _buscar(parrafos, "con codigo")
    codigo = ctx.proyecto.codigo_informe.strip()
    if p is not None and codigo:
        nuevo = re.sub(r"(con c[oó]digo\s+)[^.]*", lambda m: m.group(1) + codigo, p.text, count=1)
        if nuevo != p.text:
            set_paragraph_text(p, nuevo)


def _ubicacion(ctx: Contexto) -> str:
    m, d = ctx.datos.municipio.strip(), ctx.datos.departamento.strip()
    if m and d:
        return f"en el municipio de {m} en el departamento de {d}"
    if m:
        return f"en el municipio de {m}"
    if d:
        return f"en el departamento de {d}"
    return ""


def _objetivos(doc, ctx: Contexto, faltantes):
    general = parrafos_texto(doc, seccion(doc, "objetivo general", 2))
    if general:
        set_paragraph_text(general[0], f"Determinar los niveles de presión sonora de ruido ambiental en "
                                       f"{cantidad(ctx.n, 'punto', 'puntos')} de monitoreo, ubicados en {ctx.area}.")
    else:
        faltantes.append("Objetivo general")
    especificos = parrafos_texto(doc, seccion(doc, "objetivos especificos", 2))
    p = _buscar(especificos, "medir el nivel")
    if p is not None:
        jornadas = ctx.jornadas().replace("las jornadas diurna y nocturna", "jornada diurna y jornada nocturna")
        jornadas = jornadas.replace("la jornada", "jornada")
        set_paragraph_text(p, f"Medir el Nivel continuo Equivalente ponderado (A) de ruido ambiental, en "
                              f"{ctx.los_puntos()} de monitoreo ubicados en {ctx.area}, durante "
                              f"{ctx.tipos_dia('corto')} en {jornadas}.")


def _cliente(doc, ctx: Contexto, faltantes):
    if not ctx.cliente:
        faltantes.append("Información del cliente: el proyecto no tiene cliente; se dejó el de la plantilla")
        return
    anio = ctx.fecha.year
    elementos = seccion(doc, "informacion del cliente", 1) or []
    p = _buscar(parrafos_texto(doc, elementos), "informacion general de")
    if p is not None:
        tabla = _referencia(p.text, r"Tabla \d+", "Tabla 1")
        set_paragraph_text(p, _con_punto(f"La {tabla} relaciona la información general de {ctx.cliente}"))
    _, t = encontrar_tabla(doc, ["razon social", "nit"], filas_encabezado=3)
    if t is None:
        faltantes.append("Tabla de información del cliente")
        return
    d = ctx.datos
    valores = {
        "razon social": [ctx.cliente],
        "nit": [d.cliente_nit],
        "direccion": [d.cliente_direccion, d.cliente_contacto, d.cliente_ciudad, d.cliente_departamento],
        "actividad": [d.cliente_actividad],
    }
    filas = list(t.rows)
    for i, fila in enumerate(filas[:-1]):
        etiqueta = _sin_tildes(fila.cells[0].text.strip())
        if etiqueta in valores:
            celdas = filas[i + 1].cells
            for j, valor in enumerate(valores[etiqueta]):
                if j < len(celdas):
                    set_cell_text(celdas[j], valor)
    incompletos = [n for n, v in (("NIT", d.cliente_nit), ("dirección", d.cliente_direccion),
                                  ("contacto", d.cliente_contacto), ("ciudad", d.cliente_ciudad),
                                  ("departamento", d.cliente_departamento), ("actividad", d.cliente_actividad))
                   if not v.strip()]
    if incompletos:
        faltantes.append(f"Información del cliente incompleta (falta: {', '.join(incompletos)})")
    # "Fuente: <cliente>, <anio>." justo despues de la tabla.
    siguiente = t._element.getnext()
    if siguiente is not None and siguiente.tag == f"{_W}p":
        fp = Paragraph(siguiente, doc)
        if _sin_tildes(fp.text.strip()).startswith("fuente"):
            set_paragraph_text(fp, f"Fuente: {ctx.cliente}, {anio}.")


def _condiciones_y_tiempos(doc, ctx: Contexto, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "condiciones del area", 1))
    p = _buscar(parrafos, "se establecieron")
    if p is not None:
        set_paragraph_text(p, f"En {ctx.area}, se {'estableció' if ctx.n == 1 else 'establecieron'} "
                              f"{cantidad(ctx.n, 'punto', 'puntos')} para la ejecución del monitoreo de Ruido "
                              f"Ambiental, con el fin de identificar las fuentes sonoras del área de estudio "
                              f"durante {ctx.jornadas()} {ctx.tipos_dia()} y de esta manera valorar los niveles "
                              f"de presión sonora denotada en dB(A) según lo establecido en la Resolución 627 de 2006.")
    else:
        faltantes.append("Condiciones del área de estudio")
    parrafos = parrafos_texto(doc, seccion(doc, "tiempos de medicion", 2))
    p = _buscar(parrafos, "fecha y hora inicial")
    if p is not None:
        tablas = _referencia(p.text, r"Tabla \d+ y la Tabla \d+", "Tabla 5 y la Tabla 6")
        set_paragraph_text(p, f"La descripción de la fecha y hora inicial y final de las mediciones de ruido "
                              f"ambiental realizadas en {ctx.area}, se observan en la {tablas}. Así mismo, los "
                              f"registros se pueden observar en el Anexo 4. Registros de campo.")


def _incertidumbre_y_procedimiento(doc, ctx: Contexto):
    parrafos = parrafos_texto(doc, seccion(doc, "incertidumbre de la medicion", 3))
    p = _buscar(parrafos, "incertidumbre expandida")
    if p is not None:
        codigos = [fila[1] or fila[2] for fila in ctx.filas_equipos if (fila[1] or fila[2])]
        maximo = max((pt.incertidumbre or 0 for pt in ctx.puntos), default=0)
        texto = ("La metodología analítica propuesta para la valoración de calibración en ruido cumple con los "
                 "parámetros de precisión y exactitud")
        if codigos:
            designados = "el sonómetro designado" if len(codigos) == 1 else "los sonómetros designados"
            texto += f", evaluando las calibraciones realizadas con {designados} {lista(codigos)}"
        texto += f". El máximo valor encontrado para la incertidumbre expandida fue de: {fmt_num(maximo)}."
        set_paragraph_text(p, texto)
    parrafos = parrafos_texto(doc, seccion(doc, "procedimiento de medicion", 2))
    p = _buscar(parrafos, "jornadas de medicion")
    n = len(ctx.esquemas)
    if p is not None and n:
        jornadas = "una jornada" if n == 1 else f"{numero_en_letras(n)} jornadas"
        nuevo = re.sub(r"se realiz\w+ \w+ jornadas? de medici", f"se {'realizó' if n == 1 else 'realizaron'} "
                       f"{jornadas} de medici", p.text, count=1)
        if nuevo != p.text:
            set_paragraph_text(p, nuevo)


def _tabla_estandares(doc, ctx: Contexto, faltantes):
    """Valores de la Res. 0627 y resaltado del sector con que se comparan los puntos."""
    _, t = encontrar_tabla(doc, ["sector", "subsector", "dia", "noche"], filas_encabezado=2)
    if t is None:
        faltantes.append("Tabla de estándares máximos permisibles (Res. 0627)")
        return
    usados = {norms.buscar_sector(e).subsector for e in ctx.sectores}
    filas = list(t.rows)
    marcadas = []
    for fila in filas:
        tcs = fila._tr.tc_lst
        if len(tcs) < 4:
            marcadas.append(False)
            continue
        sub = " ".join(_sin_tildes(fila.cells[1].text).split())
        norma = next((s for s in norms.TABLA_RES_0627
                      if " ".join(_sin_tildes(s.subsector.split(" - ", 1)[-1]).split())[:30] == sub[:30]), None)
        marcadas.append(norma is not None and norma.subsector in usados)
        if norma is not None:
            for col, valor in ((2, norma.dia), (3, norma.noche)):
                if _vmerge(tcs[col]) != "continue" and fila.cells[col].text.strip() != str(valor):
                    set_cell_text(fila.cells[col], str(valor))
    if not ctx.sectores:
        return
    # Resalta las filas usadas; una celda combinada verticalmente queda resaltada
    # si alguna de sus filas esta resaltada.
    n_cols = max(len(f._tr.tc_lst) for f in filas)
    for col in range(n_cols):
        r = 2
        while r < len(filas):
            tcs = filas[r]._tr.tc_lst
            if col >= len(tcs):
                r += 1
                continue
            fin = r + 1
            if _vmerge(tcs[col]) == "restart":
                while fin < len(filas) and col < len(filas[fin]._tr.tc_lst) \
                        and _vmerge(filas[fin]._tr.tc_lst[col]) == "continue":
                    fin += 1
            resaltar = any(marcadas[r:fin])
            for k in range(r, fin):
                _sombrear(filas[k]._tr.tc_lst[col], COLOR_RESALTADO if (resaltar if col in (0, 2, 3) else marcadas[k]) else None)
            r = fin


def _vmerge(tc):
    tcPr = tc.tcPr
    if tcPr is None:
        return None
    vm = tcPr.find(qn("w:vMerge"))
    if vm is None:
        return None
    return vm.get(qn("w:val")) or "continue"


def _sombrear(tc, color):
    tcPr = tc.get_or_add_tcPr()
    shd = tcPr.find(qn("w:shd"))
    if color is None:
        if shd is not None:
            tcPr.remove(shd)
        return
    if shd is None:
        from docx.oxml import OxmlElement

        shd = OxmlElement("w:shd")
        tcPr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)


def _fuentes_de_ruido(doc, ctx: Contexto, faltantes):
    elementos = seccion(doc, "fuentes generadoras de ruido", 1)
    parrafos = parrafos_texto(doc, elementos)
    if not parrafos:
        faltantes.append("Capítulo 'Descripción de las fuentes generadoras de ruido'")
        return
    con_fuentes = [p for p in ctx.puntos if p.fuentes.strip()]
    if not con_fuentes:
        faltantes.append("Fuentes de ruido: ningún punto tiene escritas sus fuentes de ruido; el capítulo "
                         "quedó como en la plantilla")
        return
    textos = ["Las fuentes generadoras de ruido identificadas estuvieron asociadas con las condiciones "
              "particulares de cada punto de monitoreo, como se describe a continuación."]
    for p in con_fuentes:
        texto = " ".join(p.fuentes.split())
        if _sin_tildes(p.nombre) not in _sin_tildes(texto[:120]):
            primera = _sin_tildes(texto.split()[0]) if texto.split() else ""
            if primera in _INICIOS_VERBALES:
                coma = "" if primera == "se" else ","
                texto = f"En el punto {p.nombre}{coma} {texto[0].lower()}{texto[1:]}"
            else:
                texto = f"En el punto {p.nombre} se identificaron las siguientes fuentes de ruido: " \
                        f"{texto[0].lower()}{texto[1:]}"
        textos.append(texto if texto.endswith(".") else texto + ".")
    anexo = [p for p in parrafos if "anexo" in _sin_tildes(p.text)]
    cuerpo = [p for p in parrafos if p not in anexo]
    if cuerpo:
        _escribir_parrafos(cuerpo, textos)
    faltan = [p.nombre for p in ctx.puntos if not p.fuentes.strip()]
    if faltan:
        faltantes.append(f"Fuentes de ruido sin describir para: {', '.join(faltan)}")


# Si la descripcion de las fuentes empieza asi, se antepone solo "En el punto X, ".
_INICIOS_VERBALES = {"se", "predominaron", "predomino", "predominan", "hubo", "fueron", "fue", "estuvo",
                     "estuvieron", "durante", "principalmente", "las", "los", "el", "la"}


def _analisis(doc, ctx: Contexto, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "analisis de resultados para ruido", 2))
    p = _buscar(parrafos, "se observan en la tabla")
    if p is not None:
        tablas = _referencia(p.text, r"Tabla \d+ y la Tabla \d+", "Tabla 22 y la Tabla 23")
        texto = (f"Los resultados obtenidos en las mediciones de ruido ambiental en {ctx.los_puntos()} de "
                 f"monitoreo evaluados en {ctx.area} se observan en la {tablas}")
        if ctx.sectores:
            texto += (", adicionalmente, se realiza la comparación con los límites máximos permisibles según la "
                      f"Resolución 0627 de 2006 para el {ctx.texto_sectores()}")
        set_paragraph_text(p, texto + ".")
    for titulo, jornada in (("jornada diurna", "diurno"), ("jornada nocturna", "nocturno")):
        elementos = seccion(doc, titulo, 3)
        parrafos = parrafos_texto(doc, elementos)
        if not parrafos:
            faltantes.append(f"Análisis de resultados - {titulo}")
            continue
        grafica = next((m.group(0) for p in parrafos for m in [re.search(r"\(Ver Gr[aá]fica \d+\)", p.text)] if m),
                       "")
        textos = textos_jornada(ctx, jornada)
        if grafica:
            textos[-1] += f" {grafica}."
        _escribir_parrafos(parrafos, textos)


def _conclusiones(doc, ctx: Contexto, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "conclusiones", 1))
    if not parrafos:
        faltantes.append("Conclusiones (titulo 'CONCLUSIONES')")
        return
    intro = _buscar(parrafos, "se concluye")
    para = f" para {ctx.cliente}" if ctx.cliente else ""
    if intro is not None:
        set_paragraph_text(intro, f"Una vez realizado el monitoreo de ruido ambiental{para} en {ctx.area}, "
                                  f"se concluye que:")
    items = [p for p in parrafos if p is not intro]
    textos = []
    if ctx.sectores:
        textos.append(f"Los resultados obtenidos en las mediciones de ruido ambiental en {ctx.los_puntos()} de "
                      f"monitoreo fueron comparados con los estándares máximos permisibles según lo establecido en "
                      f"la Resolución 0627 de 2006, específicamente lo estipulado en el Capítulo III, Artículo 17, "
                      f"Tabla 2 de la siguiente manera: {ctx.texto_sectores('estándar')}.")
    textos.append(resumen_cumplimiento(ctx))
    textos.append(conclusion_fuentes(ctx))
    if items:
        _escribir_parrafos(items, textos)


def _portada_y_encabezado(doc, ctx: Contexto):
    titulo = [l.strip() for l in (ctx.datos.titulo or "").splitlines() if l.strip()]
    if not titulo:
        titulo = [t for t in (ctx.proyecto.nombre_proyecto.strip(), ctx.cliente) if t]
    titulo = [t.upper() for t in titulo]
    fecha_txt = ctx.fecha.strftime("%d/%m/%Y")
    version = (ctx.datos.version or "1.0").strip()
    semestre = "PRIMER SEMESTRE" if (ctx.fechas_medicion[0] if ctx.fechas_medicion else ctx.fecha).month <= 6 \
        else "SEGUNDO SEMESTRE"
    anio = (ctx.fechas_medicion[0] if ctx.fechas_medicion else ctx.fecha).year

    # Portada: cuadros de texto (se repiten en la version moderna y la de compatibilidad).
    for txbx in doc.element.body.iter(f"{_W}txbxContent"):
        ps = [Paragraph(p, None) for p in txbx.iter(f"{_W}p")]
        texto = _sin_tildes(" ".join(p.text for p in ps)).strip()
        if not texto or not titulo:
            continue
        if re.search(r"semestre", texto) and len(texto) < 40:
            _escribir_parrafos([p for p in ps if p.text.strip()], [semestre, str(anio)]
                               if len([p for p in ps if p.text.strip()]) > 1 else [f"{semestre} {anio}"])
        elif len(texto) > 25 and "informe tecnico" not in texto and not texto.startswith("fp-") \
                and "version" not in texto and _es_titulo_portada(txbx):
            _escribir_parrafos([p for p in ps if p.text.strip()], titulo)

    vistos = set()
    for seccion_doc in doc.sections:
        for hdr in (seccion_doc.header, seccion_doc.first_page_header, seccion_doc.even_page_header):
            if hdr.is_linked_to_previous or id(hdr._element) in vistos:
                continue
            vistos.add(id(hdr._element))
            for tabla in hdr.tables:
                for fila in tabla.rows:
                    for celda in fila.cells:
                        _encabezado_celda(celda.paragraphs, titulo, ctx, fecha_txt, version)


def _es_titulo_portada(txbx) -> bool:
    """El cuadro del titulo de la portada esta en letra grande (>= 14 pt)."""
    for sz in txbx.iter(f"{_W}sz"):
        try:
            if int(sz.get(qn("w:val"))) >= 28:
                return True
        except (TypeError, ValueError):
            pass
    return False


def _encabezado_celda(parrafos, titulo, ctx: Contexto, fecha_txt, version):
    for i, p in enumerate(parrafos):
        t = _sin_tildes(p.text.strip())
        siguiente = parrafos[i + 1] if i + 1 < len(parrafos) else None
        if "informe tecnico de ruido ambiental" in t and siguiente is not None and titulo:
            set_paragraph_text(siguiente, " - ".join(titulo))
        elif t == "expediente" and siguiente is not None:
            set_paragraph_text(siguiente, ctx.datos.expediente.strip() or "No aplica")
        elif t == "elaborado" and siguiente is not None:
            set_paragraph_text(siguiente, fecha_txt)
        elif t.startswith("version:"):
            set_paragraph_text(p, f"Versión:  {version}")


def _cuadro_control(doc, ctx: Contexto):
    _, t = encontrar_tabla(doc, ["version", "elaboro", "autorizo"], filas_encabezado=6)
    if t is None:
        return
    d = ctx.datos
    fecha = ctx.fecha.isoformat()
    filas = list(t.rows)
    for i, fila in enumerate(filas):
        celdas = fila.cells
        etiqueta = _sin_tildes(celdas[0].text.strip())
        if etiqueta == "version" and len(celdas) > 1:
            set_cell_text(celdas[1], (d.version or "1.0").strip())
        elif etiqueta in ("elaboro", "autorizo") and i + 1 < len(filas):
            nombre, cargo = ((d.elaboro_nombre, d.elaboro_cargo) if etiqueta == "elaboro"
                             else (d.autorizo_nombre, d.autorizo_cargo))
            destino = filas[i + 1].cells
            if nombre.strip():
                set_cell_text(destino[0], nombre.strip())
                set_cell_text(destino[1], cargo.strip())
            if len(destino) > 2:
                set_cell_text(destino[2], fecha)
        elif etiqueta.startswith("fecha de emision"):
            for c in celdas[1:]:
                if _sin_tildes(c.text.strip()).startswith("fecha"):
                    continue
                set_cell_text(c, fecha)


def _anio_fuentes(doc, ctx: Contexto):
    """Actualiza el ano de las lineas 'Fuente: ..., 2026.' (el ano mas repetido en
    ellas, que es el del informe; las citas como 'Resolucion 627 de 2006' no cambian)."""
    fuentes = []
    for el in _cuerpo(doc):
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        m = re.match(r"\s*Fuente:.*,\s*(20\d\d)\.?\s*$", p.text)
        if m:
            fuentes.append((p, m.group(1)))
    if not fuentes:
        return
    anio_plantilla = Counter(a for _, a in fuentes).most_common(1)[0][0]
    nuevo = str(ctx.fecha.year)
    if anio_plantilla == nuevo:
        return
    for p, anio in fuentes:
        if anio != anio_plantilla:
            continue
        for run in reversed(p.runs):
            if anio in run.text:
                run.text = run.text[::-1].replace(anio[::-1], nuevo[::-1], 1)[::-1]
                break
        else:
            set_paragraph_text(p, re.sub(rf"{anio}(\.?\s*)$", rf"{nuevo}\1", p.text))


def actualizar_indices_al_abrir(doc):
    """Pide a Word actualizar la tabla de contenido y los indices al abrir el
    documento (los numeros de pagina cambian al agregar o quitar puntos)."""
    ajustes = doc.settings.element
    if ajustes.find(qn("w:updateFields")) is None:
        from docx.oxml import OxmlElement

        uf = OxmlElement("w:updateFields")
        uf.set(qn("w:val"), "true")
        ajustes.append(uf)


def aplicar_textos(doc, resultados, filas_equipos=None, hoy: dt.date | None = None) -> list[str]:
    """Redacta todas las partes variables del informe. Devuelve la lista de
    partes que no se encontraron o quedaron incompletas."""
    ctx = Contexto(resultados, filas_equipos, hoy)
    faltantes: list[str] = []
    _portada_y_encabezado(doc, ctx)
    _cuadro_control(doc, ctx)
    _resumen(doc, ctx, faltantes)
    _objetivos(doc, ctx, faltantes)
    _cliente(doc, ctx, faltantes)
    _tabla_estandares(doc, ctx, faltantes)
    _condiciones_y_tiempos(doc, ctx, faltantes)
    _incertidumbre_y_procedimiento(doc, ctx)
    _fuentes_de_ruido(doc, ctx, faltantes)
    _analisis(doc, ctx, faltantes)
    _conclusiones(doc, ctx, faltantes)
    _anio_fuentes(doc, ctx)
    actualizar_indices_al_abrir(doc)
    if not ctx.datos.area_estudio.strip():
        faltantes.append("Datos del informe: no se indicó el área de estudio; se usó el nombre del proyecto")
    return faltantes
