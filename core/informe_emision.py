"""Informe Word de EMISION de ruido a partir de la plantilla del informe
ER-753-25 (templates/informe_emision_template.docx) y de los resultados de
core/emision.py.

Las tablas por jornada (fecha y hora, incertidumbre, memoria de calculo,
resultados y graficas) vienen en la plantilla una vez para la jornada diurna
y otra para la nocturna. Si en una jornada se midio en dia habil y en dia no
habil, el bloque (leyenda, tabla, notas y fuente) se duplica; si en una
jornada no se midio, el bloque se quita.
"""
from __future__ import annotations

import copy
import datetime as dt
import re

import docx
from docx.text.paragraph import Paragraph

from .docx_utils import (
    _sin_tildes,
    ajustar_bloques_de_filas,
    blips,
    encontrar_tabla,
    encontrar_tabla_por_contexto,
    escribir_filas,
    reemplazar_imagen,
    set_paragraph_text,
)
from .emision import estandares_emision
from .informe_textos import (
    Contexto,
    _anio_fuentes,
    _buscar,
    _cliente,
    _cuadro_control,
    _escribir_parrafos,
    _estilo,
    _fuentes_de_ruido,
    _portada_y_encabezado,
    _referencia,
    _sombrear,
    _tabla_estandares,
    _ubicacion,
    actualizar_indices_al_abrir,
    cantidad,
    fmt_db,
    fmt_num,
    lista,
    parrafos_texto,
    seccion,
    texto_dias,
)
from .report_generator import (
    ErrorPlantilla,
    _escribir_tarjeta,
    _filas_equipos,
    _fmt_coordenada_plana,
    _llenar_tarjetas_puntos,
    _reemplazar_imagen_tras_leyenda,
    _validar_plantilla,
    fmt_es,
)
from .geo import parsear_coordenada
from .geo_colombia import es_origen_nacional, geograficas_desde_origen_nacional

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

JORNADA_DE = {"DH": "diurna", "DNH": "diurna", "NDH": "nocturna", "NDNH": "nocturna"}
ESQUEMAS_DE = {"diurna": ("DH", "DNH"), "nocturna": ("NDH", "NDNH")}
TIPO = {"DH": "día hábil", "DNH": "día no hábil", "NDH": "día hábil", "NDNH": "día no hábil"}
COLOR_RESIDUAL = "C2D69B"  # fila de la memoria de calculo con diferencia <= 3 dB(A)
COLOR_BARRIDO = "EAF1DD"  # barrido seleccionado como punto de medicion


class ContextoEmision(Contexto):
    magnitud = "emisión de ruido"

    def limites(self, etiqueta: str):
        return estandares_emision(etiqueta)

    def jornadas_emision(self) -> list[str]:
        return [j for j in ("diurna", "nocturna") if any(e in self.esquemas for e in ESQUEMAS_DE[j])]

    def texto_jornadas(self) -> str:
        j = self.jornadas_emision()
        return "la jornada diurna y nocturna" if len(j) == 2 else f"la jornada {j[0]}" if j else ""

    def con_no_habil(self) -> bool:
        return any(e in self.esquemas for e in ("DNH", "NDNH"))


def _id(p) -> str:
    return f"P{p.no_punto}"


def _fecha_hora(v) -> str:
    from .meteorologia import _fecha

    f = _fecha(v)
    return f.strftime("%Y-%m-%d  %H:%M:%S") if f else (str(v) if v else "")


# --------------------------------------------------------- bloques por jornada
def _elementos(doc):
    return [el for el in doc.element.body.iterchildren() if el.tag in (f"{_W}p", f"{_W}tbl")]


def _bloque(doc, prefijo: str, palabras, jornada: str):
    """Elementos del bloque cuya leyenda empieza por `prefijo` ('tabla'/'grafica'),
    contiene `palabras` y la jornada, hasta la linea 'Fuente:' posterior (incluida)."""
    elementos = _elementos(doc)
    for i, el in enumerate(elementos):
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        texto = _sin_tildes(p.text.strip())
        # "diurn" encuentra tanto "jornada diurna" como "... Diurno y su respectiva ...".
        if not (_estilo(p).startswith("Caption") and texto.startswith(prefijo) and jornada[:-1] in texto
                and all(w in texto for w in palabras)):
            continue
        bloque = [el]
        for sig in elementos[i + 1:]:
            bloque.append(sig)
            if sig.tag == f"{_W}p":
                t = _sin_tildes(Paragraph(sig, doc).text.strip())
                if t.startswith("fuente") and any(b.tag == f"{_W}tbl" or blips(b) for b in bloque[1:]):
                    break
                if _estilo(Paragraph(sig, doc)).startswith(("Heading", "Caption")) and not blips(sig):
                    bloque.pop()
                    break
        return bloque
    return None


def _agregar_a_leyenda(leyenda_el, doc, sufijo: str):
    """Agrega texto al final de la leyenda sin tocar su campo de numeracion."""
    p = Paragraph(leyenda_el, doc)
    runs = [r for r in p.runs if r.text]
    if runs:
        runs[-1].text = runs[-1].text.rstrip() + sufijo
    else:
        p.add_run(sufijo)


def _bloques_por_esquema(doc, ctx: ContextoEmision, prefijo, palabras, jornada):
    """{esquema: elementos del bloque} para los esquemas medidos de la jornada,
    duplicando o quitando el bloque de la plantilla segun haga falta."""
    bloque = _bloque(doc, prefijo, palabras, jornada)
    if bloque is None:
        return None
    esquemas = [e for e in ESQUEMAS_DE[jornada] if e in ctx.esquemas]
    if not esquemas:
        for el in bloque:
            el.getparent().remove(el)
        return {}
    salida = {esquemas[0]: bloque}
    ancla = bloque[-1]
    for e in esquemas[1:]:
        copia = [copy.deepcopy(el) for el in bloque]
        for el in copia:
            ancla.addnext(el)
            ancla = el
        salida[e] = copia
    if ctx.con_no_habil():
        for e, elementos in salida.items():
            _agregar_a_leyenda(elementos[0], doc, f" – {TIPO[e].capitalize()}")
    return salida


def _tabla_de(bloque, doc):
    from docx.table import Table

    return next((Table(el, doc) for el in bloque if el.tag == f"{_W}tbl"), None)


def _puntos_con(ctx, esquema):
    return [(p, r) for p in ctx.puntos for r in [ctx.res.resultado(p, esquema)] if r is not None]


# ------------------------------------------------------------------- tablas
def _tabla_relacion(doc, ctx, faltantes):
    _, t = encontrar_tabla(doc, ["puntos de monitoreo", "id punto", "origen nacional"], filas_encabezado=2)
    if t is None:
        faltantes.append("Relación de puntos de monitoreo (coordenadas)")
        return
    filas = []
    for p in ctx.puntos:
        x, y = parsear_coordenada(p.longitud), parsear_coordenada(p.latitud)
        if x is None or y is None:
            filas.append([p.nombre, _id(p), "", "", "", ""])
            continue
        lon, lat, _, _ = geograficas_desde_origen_nacional(x, y)
        plano = es_origen_nacional(x, y)
        filas.append([p.nombre, _id(p), lat, lon, _fmt_coordenada_plana(y) if plano else "",
                      _fmt_coordenada_plana(x) if plano else ""])
    escribir_filas(t, 2, filas)


def _tarjetas(doc, ctx, faltantes):
    tabla = _llenar_tarjetas_puntos(doc, ["nombre del punto", "latitud", "longitud"])
    if not tabla:
        faltantes.append("Descripción de los puntos de medición (tarjetas)")
        return
    ajustar_bloques_de_filas(tabla, 7, len(ctx.puntos))
    for i, p in enumerate(ctx.puntos):
        _escribir_tarjeta(tabla, i, p, latitud_primero=True)


def _tablas_por_jornada(doc, ctx, graficas, faltantes):
    for jornada in ("diurna", "nocturna"):
        # Fecha y hora
        bloques = _bloques_por_esquema(doc, ctx, "tabla", ["fecha y hora"], jornada)
        if bloques is None:
            faltantes.append(f"Tabla de fecha y hora de medición (jornada {jornada})")
        for e, b in (bloques or {}).items():
            t = _tabla_de(b, doc)
            if t is not None:
                escribir_filas(t, 2, [[p.nombre, _fecha_hora(r.inicio), _fecha_hora(r.fin)]
                                      for p, r in _puntos_con(ctx, e)])
        # Incertidumbre
        bloques = _bloques_por_esquema(doc, ctx, "tabla", ["incertidumbre"], jornada)
        if bloques is None:
            faltantes.append(f"Tabla de incertidumbre (jornada {jornada})")
        for e, b in (bloques or {}).items():
            t = _tabla_de(b, doc)
            if t is None:
                continue
            filas = []
            for p, r in _puntos_con(ctx, e):
                inc = p.incertidumbre or 0
                v = r.emision
                filas.append([p.nombre, fmt_es(v), fmt_es(inc, 4),
                              fmt_es(v - inc, 3) if v is not None else "",
                              fmt_es(v + inc, 3) if v is not None else ""])
            escribir_filas(t, 2, filas)
        # Memoria de calculo
        bloques = _bloques_por_esquema(doc, ctx, "tabla", ["memoria de calculo"], jornada)
        if bloques is None:
            faltantes.append(f"Memoria de cálculo (jornada {jornada})")
        for e, b in (bloques or {}).items():
            _memoria_calculo(doc, ctx, e, b)
        # Resultados y comparacion normativa
        bloques = _bloques_por_esquema(doc, ctx, "tabla", ["resultados de los niveles"], jornada)
        if bloques is None:
            faltantes.append(f"Resultados y comparación normativa (jornada {jornada})")
        for e, b in (bloques or {}).items():
            t = _tabla_de(b, doc)
            if t is not None:
                escribir_filas(t, 1, [[p.nombre, _id(p), fmt_es(r.emision), fmt_es(r.estandar, 0)]
                                      for p, r in _puntos_con(ctx, e)])
        # Grafica
        bloques = _bloques_por_esquema(doc, ctx, "grafica", ["emision"], jornada)
        if bloques is None:
            faltantes.append(f"Gráfica de niveles de emisión (jornada {jornada})")
        for e, b in (bloques or {}).items():
            if graficas.get(e):
                imagenes = [x for el in b for x in blips(el)]
                if imagenes:
                    reemplazar_imagen(doc, imagenes[0], graficas[e])


def _memoria_calculo(doc, ctx, esquema, bloque):
    t = _tabla_de(bloque, doc)
    if t is None:
        return
    filas, residual = [], []
    for p, r in _puntos_con(ctx, esquema):
        m = r.medicion
        filas.append([_id(p), fmt_es(m.lpico), fmt_es(m.lmax), fmt_es(m.lmin), fmt_es(m.l90), fmt_es(m.laeq),
                      fmt_es(m.laieq), fmt_es(m.li), fmt_es(m.ki), fmt_es(m.kt), fmt_es(0.0), fmt_es(m.ks),
                      fmt_es(m.correccion_pantalla), fmt_es(m.correccion), fmt_es(m.lraeq_corregido),
                      fmt_es(m.l90_corregido), fmt_es(r.residual), fmt_es(r.emision), fmt_es(p.incertidumbre, 4),
                      fmt_es(r.diferencia)])
        residual.append(r.del_orden_del_residual)
    escribir_filas(t, 2, filas)
    for fila, verde in zip(list(t.rows)[2:], residual):
        for tc in fila._tr.tc_lst:
            _sombrear(tc, COLOR_RESIDUAL if verde else None)
    # Notas: significado de cada ID y, si aplica, la del literal F.
    for el in bloque:
        if el.tag != f"{_W}p":
            continue
        p = Paragraph(el, doc)
        t_nota = _sin_tildes(p.text.strip())
        if t_nota.startswith("nota 1"):
            set_paragraph_text(p, "Nota 1: " + lista(f"{_id(x)}: {x.nombre}" for x, _ in _puntos_con(ctx, esquema))
                               + ".")
        elif t_nota.startswith("nota 2") and not any(residual):
            el.getparent().remove(el)


def _tabla_barrido(doc, ctx, faltantes):
    _, t = encontrar_tabla(doc, ["id punto", "condiciones de la fuente"], filas_encabezado=1)
    barrido = ctx.res.barrido
    if t is None:
        if barrido:
            faltantes.append("Tabla de resultados del barrido")
        return
    if not barrido:
        faltantes.append("Barrido: no se subieron memorias del barrido; la sección quedó como en la plantilla")
        return
    filas = []
    for b in barrido:
        ini, fin = b.inicio, b.fin
        filas.append([b.nombre, b.condicion,
                      ini.strftime("%Y-%m-%d") if isinstance(ini, dt.datetime) else "",
                      ini.strftime("%H:%M") if isinstance(ini, dt.datetime) else "",
                      fin.strftime("%H:%M") if isinstance(fin, dt.datetime) else "",
                      fin.strftime("%Y-%m-%d") if isinstance(fin, dt.datetime) else "",
                      fmt_es(b.leq)])
    escribir_filas(t, 1, filas)
    for fila, b in zip(list(t.rows)[1:], barrido):
        for tc in fila._tr.tc_lst:
            _sombrear(tc, COLOR_BARRIDO if b.seleccionado else None)


# ------------------------------------------------------------------- textos
def _txt_puntos(ctx) -> str:
    return cantidad(ctx.n, "punto", "puntos")


def _resumen(doc, ctx, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "resumen", 1))
    if not parrafos:
        faltantes.append("Resumen (titulo 'RESUMEN')")
        return
    hay_barrido = bool(ctx.res.barrido)
    p = _buscar(parrafos, "presente estudio")
    if p is not None:
        ubic = _ubicacion(ctx)
        verbo = "se estableció" if ctx.n == 1 else "se establecieron"
        texto = (f"El presente estudio determina los niveles de presión sonora de emisión de ruido que se presentan "
                 f"actualmente en {ctx.area}{', ' + ubic if ubic else ''}, para el logro de este objetivo {verbo} "
                 f"{_txt_puntos(ctx)} de monitoreo denominados: {lista(x.nombre for x in ctx.puntos)}.")
        if hay_barrido:
            texto += (f" Cabe aclarar que {'el punto fue definido' if ctx.n == 1 else 'los puntos fueron definidos'} "
                      "con base en los resultados obtenidos durante el barrido de ruido previamente realizado en "
                      "campo, priorizando las zonas representativas y los sectores donde se registraron los mayores "
                      "niveles de presión sonora dB(A).")
        set_paragraph_text(p, texto)
    p = _buscar(parrafos, "fueron ejecutadas")
    if p is not None and ctx.fechas_medicion:
        original = p.text
        corte = original.find("; lo anterior")
        resto = original[corte:] if corte > 0 else "."
        jornadas = ctx.jornadas_emision()
        medicion = ("se tomó una medición para la jornada diurna y otra medición para la jornada nocturna"
                    if len(jornadas) == 2 else f"se tomó una medición en la jornada {jornadas[0]}")
        set_paragraph_text(p, f"Las mediciones para emisión de ruido fueron ejecutadas {texto_dias(ctx.fechas_medicion)}; "
                              f"para {'el punto' if ctx.n == 1 else 'los ' + _txt_puntos(ctx)} de monitoreo se "
                              "establecieron mediciones de 1 hora continua en dirección hacia la fuente de emisión a "
                              "1,50 m del área perimetral y a 1,20 m a partir del nivel mínimo donde se encuentra "
                              f"instalada la fuente de emisión de ruido, {medicion}{resto}")
    p = _buscar(parrafos, "articulo 9")
    if p is not None and ctx.sectores:
        tabla = _referencia(p.text, r"Tabla \d+", "Tabla 2")
        comparacion = (f"con el {ctx.texto_sectores()}" if len(ctx.sectores) == 1
                       else f"con el sector asignado a cada punto: {ctx.texto_sectores()}")
        set_paragraph_text(p, "De acuerdo con la Resolución 627 de 2006, el Artículo 9 establece los estándares máximos "
                              "permisibles de emisión de ruido según la clasificación del sector en donde se realice la "
                              f"medición. Dichos valores se consignan en la {tabla}, la cual se tomó en cuenta para "
                              "clasificar los puntos de medición, por lo tanto, se realiza la respectiva comparación de "
                              f"los resultados obtenidos {comparacion}.")
    p = _buscar(parrafos, "con codigo")
    codigo = ctx.proyecto.codigo_informe.strip()
    if p is not None and codigo:
        nuevo = re.sub(r"(con c[oó]digo\s+)[^.]*", lambda m: m.group(1) + codigo, p.text, count=1)
        if nuevo != p.text:
            set_paragraph_text(p, nuevo)


def _objetivos(doc, ctx, faltantes):
    general = parrafos_texto(doc, seccion(doc, "objetivo general", 2))
    if general:
        set_paragraph_text(general[0], f"Determinar los niveles de presión sonora de emisión de ruido en {ctx.area}.")
    else:
        faltantes.append("Objetivo general")
    especificos = parrafos_texto(doc, seccion(doc, "objetivos especificos", 2))
    hay_barrido = bool(ctx.res.barrido)
    p = _buscar(especificos, "barrido")
    if p is not None and not hay_barrido:
        p._element.getparent().remove(p._element)
    p = _buscar(especificos, "medir los niveles")
    if p is not None:
        horario = {"diurna": "diurno", "nocturna": "nocturno"}
        jornadas = " y ".join(horario[j] for j in ctx.jornadas_emision())
        texto = (f"Medir los niveles de ruido continuo en {_txt_puntos(ctx)} de monitoreo de emisión de ruido, en "
                 f"horario {jornadas}, ubicados en {ctx.area}")
        if hay_barrido:
            texto += ", definidos previamente a partir del barrido de ruido realizado en campo"
        set_paragraph_text(p, texto + ".")


def _condiciones_y_metodologia(doc, ctx, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "condiciones del area", 1))
    p = _buscar(parrafos, "se establecieron")
    if p is not None:
        set_paragraph_text(p, f"En {ctx.area}, se {'estableció' if ctx.n == 1 else 'establecieron'} {_txt_puntos(ctx)} "
                              f"de monitoreo para la emisión de ruido, con el fin de identificar las fuentes sonoras del "
                              f"área de estudio durante {ctx.texto_jornadas()} y de esta manera valorar los niveles de "
                              "presión sonora denotada en dB(A) según lo establecido en la Resolución 627 de 2006.")
    else:
        faltantes.append("Condiciones del área de estudio")
    parrafos = parrafos_texto(doc, seccion(doc, "descripcion y localizacion", 2))
    hay_barrido = bool(ctx.res.barrido)
    p = _buscar(parrafos, "barrido preliminar")
    if p is not None:
        if hay_barrido:
            set_paragraph_text(p, re.sub(r"en el área perimetral de[^,]*,", f"en el área perimetral {ctx.del_area},",
                                         p.text, count=1))
        else:
            p._element.getparent().remove(p._element)
    p = _buscar(parrafos, "resultados de dicho barrido")
    if p is not None and not hay_barrido:
        p._element.getparent().remove(p._element)
    parrafos = parrafos_texto(doc, seccion(doc, "tiempos de medicion", 2))
    p = _buscar(parrafos, "fecha y hora inicial")
    if p is not None:
        set_paragraph_text(p, f"La descripción de la fecha y hora inicial y final de las mediciones de emisión de ruido "
                              f"realizadas en {ctx.area}, se observan en las tablas siguientes. Así mismo, los registros "
                              "se pueden observar en el Anexo 4. Registros de campo.")


def _incertidumbre(doc, ctx):
    parrafos = parrafos_texto(doc, seccion(doc, "incertidumbre de la medicion", 3))
    p = _buscar(parrafos, "incertidumbre expandida")
    if p is not None:
        codigos = [f[1] or f[2] for f in ctx.filas_equipos if (f[1] or f[2])]
        maximo = max((x.incertidumbre or 0 for x in ctx.puntos), default=0)
        texto = ("La metodología analítica propuesta para la valoración de calibración en ruido cumple con los "
                 "parámetros de precisión y exactitud")
        if codigos:
            texto += (f", evaluando las calibraciones en {'el sonómetro designado' if len(codigos) == 1 else 'los sonómetros designados'} "
                      f"{lista(codigos)}")
        set_paragraph_text(p, texto + f". El máximo valor encontrado para la incertidumbre expandida fue de: "
                                      f"{fmt_num(maximo)}.")


def _nota_residual(doc, ctx):
    """Nota del procedimiento: residual medido con la fuente apagada o L90."""
    parrafos = parrafos_texto(doc, seccion(doc, "procedimiento de medicion", 2))
    p = _buscar(parrafos, "ruido residual", "l90")
    if p is None:
        return
    resultados = [(x, e, r) for x in ctx.puntos for e in ctx.esquemas for r in [ctx.res.resultado(x, e)] if r]
    con_l90 = [r for _, _, r in resultados if r.residual_es_l90]
    medidos = [f"{x.nombre} (periodo {'diurno' if JORNADA_DE[e] == 'diurna' else 'nocturno'}, {TIPO[e]})"
               for x, e, r in resultados if not r.residual_es_l90]
    if con_l90 and not medidos:
        return  # el texto de la plantilla ya lo explica
    if medidos and not con_l90:
        set_paragraph_text(p, "Nota: El ruido residual se midió con las fuentes de emisión sin operación (ruido total "
                              "con suspensión de los ruidos específicos), y se corrigió con la misma metodología de la "
                              "medición con las fuentes en funcionamiento.")
        return
    set_paragraph_text(p, f"Nota: El ruido residual se midió con las fuentes sin operación en {lista(medidos)}. En "
                          "las demás mediciones, dadas las condiciones de operación de las fuentes de emisión, no fue "
                          "posible suspender su funcionamiento; en su lugar, se presenta el nivel percentil L90, "
                          "conforme a lo establecido en la resolución aplicable para esta condición.")


def _barrido_textos(doc, ctx):
    barrido = ctx.res.barrido
    if not barrido:
        return
    elementos = seccion(doc, "resultados del barrido", 2) or []
    parrafos = parrafos_texto(doc, elementos)
    for el in elementos:  # incluye la leyenda de la tabla (sin tocar su numeracion)
        if el.tag == f"{_W}p":
            for run in Paragraph(el, doc).runs:
                run.text = run.text.replace("de la refinería", "del área de estudio")
    seleccionados = [b for b in barrido if b.seleccionado]
    p = _buscar(parrafos, "subrayados")
    if p is not None:
        if seleccionados:
            set_paragraph_text(p, f"Nota: Los barridos sombreados en color verde corresponden a "
                                  f"{'el punto definido' if len(seleccionados) == 1 else 'los ' + cantidad(len(seleccionados), 'punto definido', 'puntos definidos')} "
                                  "para la ejecución del monitoreo de emisión de ruido, conforme a los criterios técnicos "
                                  "establecidos durante el barrido acústico.")
        else:
            p._element.getparent().remove(p._element)
    p = _buscar(parrafos, "mayores niveles")
    con_leq = [b for b in barrido if b.leq is not None]
    if p is not None and con_leq:
        altos, bajos = con_leq[:3], list(reversed(con_leq[3:][-3:]))
        texto = (f"De acuerdo con los resultados registrados, los mayores niveles de presión sonora se presentaron en "
                 f"{'el punto' if len(altos) == 1 else 'los puntos'} {lista(b.nombre for b in altos)}, con "
                 f"{'un valor' if len(altos) == 1 else 'valores'} de {lista(fmt_db(b.leq) + ' dB(A)' for b in altos)}"
                 f"{', respectivamente' if len(altos) > 1 else ''}.")
        if len(bajos) == 1:
            texto += (f" En contraste, el menor nivel se registró en el punto {bajos[0].nombre}, con un valor de "
                      f"{fmt_db(bajos[0].leq)} dB(A).")
        elif bajos:
            texto += (f" En contraste, los menores niveles se registraron en los puntos {lista(b.nombre for b in bajos)}, "
                      f"con valores de {lista(fmt_db(b.leq) + ' dB(A)' for b in bajos)}, respectivamente.")
        set_paragraph_text(p, texto)


def _texto_jornada(ctx, esquema) -> list[str]:
    filas = [(p, r) for p, r in _puntos_con(ctx, esquema) if r.emision is not None]
    if not filas:
        return []
    periodo = "diurno" if JORNADA_DE[esquema] == "diurna" else "nocturno"
    tipo = f" ({TIPO[esquema]})" if ctx.con_no_habil() else ""
    estandares = sorted({r.estandar for _, r in filas if r.estandar is not None})
    ref = (f"un estándar máximo permisible de {fmt_num(estandares[0])} dB(A)" if len(estandares) == 1
           else "el estándar máximo permisible del sector asignado a cada punto")
    bajo = min(filas, key=lambda x: x[1].emision)
    alto = max(filas, key=lambda x: x[1].emision)
    nivel = lambda p, r: f"{p.nombre} ({fmt_db(r.emision)} dB(A))"  # noqa: E731
    parrafos = []
    iguales = len(filas) > 1 and round(bajo[1].emision, 1) == round(alto[1].emision, 1)
    if iguales:
        parrafos.append(f"De acuerdo con los resultados obtenidos en la medición de emisión de ruido en periodo "
                        f"{periodo}{tipo}, todos los puntos registraron {fmt_db(alto[1].emision)} dB(A), frente a "
                        f"{ref} para el periodo {periodo}.")
    elif len(filas) > 1:
        parrafos.append(f"De acuerdo con los resultados obtenidos en la medición de emisión de ruido en periodo "
                        f"{periodo}{tipo}, los valores medidos se encuentran en un rango comprendido entre "
                        f"{fmt_db(bajo[1].emision)} dB(A) y {fmt_db(alto[1].emision)} dB(A), frente a {ref} para el "
                        f"periodo {periodo}.")
    else:
        parrafos.append(f"En el periodo {periodo}{tipo} se obtuvo un nivel de emisión de ruido de "
                        f"{fmt_db(bajo[1].emision)} dB(A) en {bajo[0].nombre}, frente a {ref}.")
    comparables = [(p, r) for p, r in filas if r.cumple]
    debajo = [nivel(p, r) for p, r in comparables if r.cumple == "Si"]
    encima = [nivel(p, r) for p, r in comparables if r.cumple == "No"]
    frases = []
    if debajo and not encima:
        frases.append(f"{'Los valores obtenidos en los puntos' if len(debajo) > 1 else 'El valor obtenido en'} "
                      f"{lista(debajo)} se {'sitúan' if len(debajo) > 1 else 'sitúa'} dentro del valor máximo "
                      f"establecido para la jornada {JORNADA_DE[esquema]}.")
    elif encima and not debajo:
        frases.append(f"{'En los puntos' if len(encima) > 1 else 'En'} {lista(encima)} los niveles medidos se "
                      f"encuentran por encima del estándar máximo permisible para la jornada {JORNADA_DE[esquema]}.")
    elif encima and debajo:
        frases.append(f"En {'los puntos ' if len(debajo) > 1 else ''}{lista(debajo)}, los niveles registrados se "
                      f"ubican por debajo del valor de referencia establecido para la jornada {JORNADA_DE[esquema]}. "
                      f"Por su parte, en {'los puntos ' if len(encima) > 1 else ''}{lista(encima)}, los niveles "
                      "medidos se encuentran por encima del estándar máximo permisible.")
    if len(filas) > 1 and not iguales:
        frases.append(f"El mayor nivel de presión sonora registrado corresponde al punto {nivel(*alto)}, mientras que "
                      f"el menor valor se evidenció en {nivel(*bajo)}.")
    del_orden = [p.nombre for p, r in filas if r.del_orden_del_residual]
    if del_orden:
        frases.append(f"En {lista(del_orden)} la diferencia aritmética entre el LRAeq,1h y el LRAeq,1h residual es "
                      "igual o inferior a 3 dB(A), por lo que el nivel de emisión es del orden igual o inferior al "
                      "ruido residual.")
    if frases:
        parrafos.append(" ".join(frases))
    return parrafos


def _analisis(doc, ctx, faltantes):
    elementos = seccion(doc, "analisis de resultados", 1)
    if not elementos:
        faltantes.append("Análisis de resultados")
        return
    parrafos = parrafos_texto(doc, elementos)
    p = _buscar(parrafos, "se observan en la tabla")
    if p is not None:
        texto = (f"Los resultados obtenidos en las mediciones de emisión de ruido en "
                 f"{'el punto' if ctx.n == 1 else 'los ' + _txt_puntos(ctx)} de monitoreo se observan en las tablas "
                 "siguientes")
        if ctx.sectores:
            texto += (". Adicionalmente, se realiza la comparación de estos con los límites máximos permisibles según lo "
                      "establecido en la Resolución 0627 de 2006 específicamente lo estipulado en el Capítulo II, "
                      f"Artículo 9, Tabla 1 de la siguiente manera: {ctx.texto_sectores()}")
        set_paragraph_text(p, texto + ".")
    # Subtitulos "Jornada Diurna" / "Jornada Nocturna" (parrafos de lista).
    marcas = {}
    for el in elementos:
        if el.tag == f"{_W}p":
            t = _sin_tildes(Paragraph(el, doc).text.strip())
            if t in ("jornada diurna", "jornada nocturna"):
                marcas[t.split()[1]] = el
    for jornada in ("diurna", "nocturna"):
        marca = marcas.get(jornada)
        if marca is None:
            continue
        inicio = elementos.index(marca)
        otra = marcas.get("nocturna" if jornada == "diurna" else "diurna")
        fin = elementos.index(otra) if otra is not None and elementos.index(otra) > inicio else len(elementos)
        textos = [t for e in ESQUEMAS_DE[jornada] if e in ctx.esquemas for t in _texto_jornada(ctx, e)]
        cuerpo = [p for p in parrafos_texto(doc, elementos[inicio + 1:fin]) if p._element is not marca]
        if not textos:
            # Jornada no medida: se quita el subtitulo y sus parrafos (la grafica ya se quito).
            for p in cuerpo:
                p._element.getparent().remove(p._element)
            marca.getparent().remove(marca)
            continue
        _escribir_parrafos(cuerpo, textos)


def _conclusiones(doc, ctx, faltantes):
    parrafos = parrafos_texto(doc, seccion(doc, "conclusiones", 1))
    if not parrafos:
        faltantes.append("Conclusiones (titulo 'CONCLUSIONES')")
        return
    intro = _buscar(parrafos, "se concluye")
    if intro is not None:
        set_paragraph_text(intro, f"Una vez realizado el monitoreo de emisión de ruido en {ctx.area}, y de acuerdo con "
                                  "los estándares máximos permisibles establecidos en la Resolución 627 de 2006, y el "
                                  "sector y subsector correspondiente, se concluye que:")
    items = [p for p in parrafos if p is not intro]
    textos = []
    if ctx.res.barrido:
        textos.append("Los puntos de medición de emisión de ruido fueron seleccionados con base en el barrido "
                      "perimetral realizado, efectuado en cumplimiento del procedimiento del capítulo I del Anexo 3 de "
                      "la Resolución 627 del 07 de abril del 2006, como etapa preliminar para el desarrollo de esta "
                      "medición.")
    if ctx.sectores:
        textos.append("Para los resultados obtenidos en las mediciones de emisión de ruido en los puntos de monitoreo "
                      "se realizó la comparación de estos con el límite máximo permisible según lo establecido en la "
                      f"Resolución 0627 de 2006, {ctx.texto_sectores()}.")
    resumen = []
    for e in ctx.esquemas:
        filas = [(p, r) for p, r in _puntos_con(ctx, e) if r.cumple]
        if not filas:
            continue
        periodo = f"el periodo {'diurno' if JORNADA_DE[e] == 'diurna' else 'nocturno'}"
        if ctx.con_no_habil():
            periodo += f" ({TIPO[e]})"
        encima = [p.nombre for p, r in filas if r.cumple == "No"]
        debajo = [p.nombre for p, r in filas if r.cumple == "Si"]
        if not encima:
            resumen.append(f"En {periodo}, los niveles registrados en todos los puntos de monitoreo evaluados se "
                           "ubicaron por debajo del estándar máximo permisible aplicable para dicha jornada.")
        elif not debajo:
            resumen.append(f"En {periodo}, los niveles registrados en todos los puntos de monitoreo evaluados se "
                           "ubicaron por encima del estándar máximo permisible aplicable para dicha jornada.")
        else:
            resumen.append(f"En {periodo}, {'los puntos' if len(encima) > 1 else 'el punto'} {lista(encima)} "
                           f"{'registraron valores' if len(encima) > 1 else 'registró un valor'} por encima del "
                           f"estándar establecido; por su parte, {'los puntos' if len(debajo) > 1 else 'el punto'} "
                           f"{lista(debajo)} {'presentaron niveles' if len(debajo) > 1 else 'presentó un nivel'} por "
                           "debajo del valor de referencia.")
    if resumen:
        textos.append("Con base en los resultados obtenidos en las mediciones de emisión de ruido, se establece lo "
                      "siguiente: " + " ".join(resumen))
    from .informe_textos import conclusion_fuentes

    # En emision hay una sola posicion del microfono por punto.
    textos.append(conclusion_fuentes(ctx).replace(", la orientación del micrófono y el periodo", " y el periodo"))
    if items:
        _escribir_parrafos(items, textos)


# ------------------------------------------------------------------ principal
def generar_informe_emision(resultados, ruta_plantilla: str, ruta_salida: str, graficas: dict | None = None,
                            ruta_equipos: str | None = None, meteo=None, hoy=None):
    """Devuelve (ruta_salida, faltantes)."""
    _validar_plantilla(ruta_plantilla)
    try:
        doc = docx.Document(ruta_plantilla)
    except Exception as exc:  # noqa: BLE001
        raise ErrorPlantilla(f"No se pudo abrir la plantilla como documento Word:\n{exc}") from exc
    graficas = graficas or {}
    faltantes: list[str] = []
    filas_equipos = _filas_equipos(resultados, ruta_equipos)
    ctx = ContextoEmision(resultados, filas_equipos, hoy)

    _tabla_relacion(doc, ctx, faltantes)
    _tarjetas(doc, ctx, faltantes)
    t_equipos = encontrar_tabla_por_contexto(doc, requeridos=["nombre", "codigo", "serial"],
                                             contexto_excluido=["calibrador"], filas_encabezado=1)
    if t_equipos is not None and filas_equipos:
        escribir_filas(t_equipos, 1, filas_equipos)
    elif not filas_equipos:
        faltantes.append("Equipos de medición (no se detectó ningún número de serie en las memorias)")
    _tablas_por_jornada(doc, ctx, graficas, faltantes)
    _tabla_barrido(doc, ctx, faltantes)
    if graficas.get("localizacion") and not _reemplazar_imagen_tras_leyenda(
            doc, ("imagen", "localizacion"), graficas["localizacion"]):
        faltantes.append("Imagen de localización de los puntos (leyenda 'Imagen 1. Localización')")

    _portada_y_encabezado(doc, ctx)
    _cuadro_control(doc, ctx)
    _resumen(doc, ctx, faltantes)
    _objetivos(doc, ctx, faltantes)
    _cliente(doc, ctx, faltantes)
    _tabla_estandares(doc, ctx, faltantes)
    _condiciones_y_metodologia(doc, ctx, faltantes)
    _incertidumbre(doc, ctx)
    _nota_residual(doc, ctx)
    _barrido_textos(doc, ctx)
    _fuentes_de_ruido(doc, ctx, faltantes)
    _analisis(doc, ctx, faltantes)
    _conclusiones(doc, ctx, faltantes)
    _anio_fuentes(doc, ctx)
    actualizar_indices_al_abrir(doc)
    if not ctx.datos.area_estudio.strip():
        faltantes.append("Datos del informe: no se indicó el área de estudio; se usó el nombre del proyecto")

    if meteo is None:
        faltantes.append("Capítulo de meteorología: no hay datos de la estación meteorológica para los días de "
                         "medición; quedó el texto de la plantilla")
    else:
        from .meteo_informe import aplicar_meteorologia

        faltantes += aplicar_meteorologia(doc, *meteo)

    doc.save(ruta_salida)
    return ruta_salida, faltantes
