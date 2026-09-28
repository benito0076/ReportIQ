"""Logica del motor: descarga los archivos del proyecto, arma el Proyecto del
paquete `core` (el mismo que usa la aplicacion de escritorio) y ejecuta el
procesamiento / la generacion de entregables.

El motor no guarda nada: cada peticion trabaja en una carpeta temporal que se
borra al terminar."""
from __future__ import annotations

import io
import json
import os
import re
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Optional

import httpx

from core.charts import generar_graficas
from core.excel_export import exportar_resultados
from core import isophones
from core.isophones import SinCoordenadasError, generar_mapa_isofonas_esquema
from core import meteorologia
from core.models import ESQUEMA_LABELS, ESQUEMAS, ArchivoMemoria, Proyecto, Punto
from core.pipeline import ResultadosProyecto, procesar_proyecto
from core.report_generator import ErrorPlantilla, generar_informe

from .schemas import ArchivoRemoto, EquipoIn, ProyectoIn

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTILLA_DEFECTO = os.path.join(RAIZ, "templates", "informe_template.docx")

MAX_BYTES_ARCHIVO = int(os.environ.get("ENGINE_MAX_FILE_MB", "40")) * 1024 * 1024
DESCARGAS_SIMULTANEAS = 8
# ENGINE_BASEMAP=0 desactiva la descarga del mapa satelital de fondo de las
# isofonas (pruebas, o servidores sin salida a internet).
CON_MAPA_BASE = os.environ.get("ENGINE_BASEMAP", "1") != "0"

# matplotlib (pyplot) no es seguro entre hilos: se serializa la generacion de
# graficas/mapas. Es una herramienta interna con poco trafico simultaneo.
_LOCK_GRAFICOS = threading.Lock()

MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class ErrorDescarga(Exception):
    pass


class ErrorEntrada(Exception):
    """Error atribuible a los datos enviados (plantilla invalida, etc.)."""


@dataclass
class Contexto:
    carpeta: str
    proyecto: Proyecto
    # ruta local -> nombre original, para que los mensajes muestren el nombre
    # del archivo que subio el usuario y no la ruta temporal.
    nombres: dict = field(default_factory=dict)
    ruta_meteo: Optional[str] = None


@dataclass
class Entregable:
    contenido: bytes
    nombre_archivo: str
    content_type: str
    advertencias: list


def _extension(nombre: str, defecto: str) -> str:
    ext = os.path.splitext(nombre or "")[1].lower()
    return ext if re.fullmatch(r"\.[a-z0-9]{1,5}", ext or "") else defecto


def _descargar(cliente: httpx.Client, archivo: ArchivoRemoto, destino: str):
    try:
        with cliente.stream("GET", archivo.url) as r:
            if r.status_code != 200:
                raise ErrorDescarga(f"No se pudo descargar '{archivo.nombre or 'archivo'}' (HTTP {r.status_code}).")
            total = 0
            with open(destino, "wb") as f:
                for bloque in r.iter_bytes():
                    total += len(bloque)
                    if total > MAX_BYTES_ARCHIVO:
                        raise ErrorDescarga(f"El archivo '{archivo.nombre}' supera el tamano maximo permitido.")
                    f.write(bloque)
    except httpx.HTTPError as exc:
        raise ErrorDescarga(f"No se pudo descargar '{archivo.nombre or 'archivo'}': {exc}") from exc


def preparar(proyecto_in: ProyectoIn, carpeta: str, plantilla: Optional[ArchivoRemoto] = None) -> tuple[Contexto, Optional[str]]:
    """Descarga memorias, fotos y plantilla, y construye el Proyecto de `core`.
    Devuelve (contexto, ruta_plantilla_descargada|None)."""
    proyecto = Proyecto(
        nombre_proyecto=proyecto_in.nombre_proyecto,
        codigo_informe=proyecto_in.codigo_informe,
        cliente=proyecto_in.cliente,
    )
    ctx = Contexto(carpeta=carpeta, proyecto=proyecto)
    descargas: list[tuple[ArchivoRemoto, str]] = []

    for i, pin in enumerate(proyecto_in.puntos):
        punto = Punto(
            no_punto=pin.no_punto, nombre=pin.nombre, sector=pin.sector,
            longitud=pin.este, latitud=pin.norte, incertidumbre=pin.incertidumbre,
            altitud=pin.altitud, descripcion=pin.descripcion,
        )
        for esquema, por_direccion in pin.memorias.items():
            for direccion, archivo in por_direccion.items():
                ruta = os.path.join(carpeta, f"p{i}_{esquema}_{direccion}{_extension(archivo.nombre, '.xlsx')}")
                punto.archivos[esquema][direccion] = ArchivoMemoria(direccion, ruta)
                ctx.nombres[ruta] = archivo.nombre or os.path.basename(ruta)
                descargas.append((archivo, ruta))
        if pin.foto is not None:
            ruta = os.path.join(carpeta, f"p{i}_foto{_extension(pin.foto.nombre, '.jpg')}")
            punto.foto_ruta = ruta
            descargas.append((pin.foto, ruta))
        for c in pin.correcciones_manuales:
            punto.correcciones_manuales[(c.esquema, c.direccion)] = {"KS": c.KS, "pantalla": c.pantalla}
        proyecto.puntos.append(punto)

    if proyecto_in.meteorologia is not None:
        ctx.ruta_meteo = os.path.join(carpeta, "meteorologia.xlsx")
        descargas.append((proyecto_in.meteorologia, ctx.ruta_meteo))

    ruta_plantilla = None
    if plantilla is not None:
        ruta_plantilla = os.path.join(carpeta, "plantilla.docx")
        descargas.append((plantilla, ruta_plantilla))

    if descargas:
        with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0), follow_redirects=True) as cliente:
            with ThreadPoolExecutor(max_workers=DESCARGAS_SIMULTANEAS) as pool:
                # list() propaga la primera excepcion de descarga.
                list(pool.map(lambda d: _descargar(cliente, d[0], d[1]), descargas))
    return ctx, ruta_plantilla


def procesar(ctx: Contexto) -> ResultadosProyecto:
    resultados = procesar_proyecto(ctx.proyecto)
    for adv in resultados.advertencias:
        for ruta, nombre in ctx.nombres.items():
            adv.mensaje = adv.mensaje.replace(ruta, nombre)
    return resultados


# --------------------------------------------------------------- serializacion
def _valor(v):
    if isinstance(v, (datetime, date, time)):
        return v.isoformat(sep=" ") if isinstance(v, datetime) else v.isoformat()
    if isinstance(v, float):
        return round(v, 4)
    return v


_CAMPOS_DIRECCION = [
    "direccion", "inicio", "fin", "lpico", "lmax", "lmin", "l90", "laeq", "laieq",
    "li", "ki", "kt", "ks", "correccion_pantalla", "correccion", "l90_corregido",
    "lraeq_corregido", "tipo_ajuste", "numero_serie", "modelo",
]


def resultados_a_dict(resultados: ResultadosProyecto) -> dict:
    puntos = []
    for punto in resultados.proyecto.puntos:
        rc = resultados.comparacion.get(punto.no_punto)
        esquemas = {}
        for esquema, rp in resultados.por_punto.get(punto.no_punto, {}).items():
            esquemas[esquema] = {
                "lraeq_resultante": _valor(rp.lraeq_resultante),
                "inicio": _valor(rp.inicio),
                "fin": _valor(rp.fin),
                "direcciones": [
                    {c: _valor(getattr(rd, c)) for c in _CAMPOS_DIRECCION}
                    for rd in rp.direcciones.values()
                ],
            }
        puntos.append({
            "no_punto": punto.no_punto,
            "nombre": punto.nombre,
            "sector": punto.sector,
            "incertidumbre": punto.incertidumbre,
            "estandar_diurno": rc.estandar_diurno if rc else None,
            "estandar_nocturno": rc.estandar_nocturno if rc else None,
            "cumple": {
                "DH": rc.cumple_dh if rc else None, "DNH": rc.cumple_dnh if rc else None,
                "NDH": rc.cumple_ndh if rc else None, "NDNH": rc.cumple_ndnh if rc else None,
            },
            "esquemas": esquemas,
        })
    return {
        "puntos": puntos,
        "advertencias": [
            {"punto": a.punto, "esquema": a.esquema, "direccion": a.direccion, "mensaje": a.mensaje}
            for a in resultados.advertencias
        ],
        "equipos_detectados": [
            {"serial": str(s), "modelo": m} for s, m in resultados.equipos_detectados.items()
        ],
    }


# ------------------------------------------------------------------ entregables
def _nombre_base(ctx: Contexto) -> str:
    base = ctx.proyecto.codigo_informe or ctx.proyecto.nombre_proyecto or "proyecto"
    base = re.sub(r"[^\w\-. ]+", "_", base, flags=re.UNICODE).strip() or "proyecto"
    return base[:80]


def _generar_isofonas(ctx: Contexto, resultados, carpeta: str, elaborado_por: str, con_titulo: bool):
    rutas, errores = {}, []
    extra = {"elaborado_por": elaborado_por} if elaborado_por else {}
    for esquema in ESQUEMAS:
        if not any(esquema in resultados.por_punto.get(p.no_punto, {}) for p in ctx.proyecto.puntos):
            continue
        etiqueta = ESQUEMA_LABELS[esquema]
        titulo = f"Mapa de isofonas - {etiqueta} - {ctx.proyecto.nombre_proyecto}" if con_titulo else ""
        isophones.ultimo_error_mapa_base = None
        try:
            rutas[esquema] = generar_mapa_isofonas_esquema(
                resultados, esquema, os.path.join(carpeta, f"isofonas_{esquema}.png"),
                titulo=titulo, con_basemap=CON_MAPA_BASE, **extra,
            )
        except SinCoordenadasError as exc:
            errores.append(f"Mapa de isofonas {etiqueta}: {exc}")
        if isophones.ultimo_error_mapa_base:
            aviso = f"Mapa satelital no disponible ({isophones.ultimo_error_mapa_base})"
            if aviso not in errores:
                errores.append(aviso)
    return rutas, errores


def generar_excel(ctx: Contexto) -> Entregable:
    resultados = procesar(ctx)
    ruta = os.path.join(ctx.carpeta, "resultados.xlsx")
    exportar_resultados(resultados, ruta)
    with open(ruta, "rb") as f:
        contenido = f.read()
    return Entregable(contenido, f"{_nombre_base(ctx)} - Resultados.xlsx", MIME_XLSX,
                      [a.mensaje for a in resultados.advertencias])


def _meteorologia(ctx: Contexto, resultados, carpeta: str):
    """Analisis meteorologico de los dias de medicion. Devuelve
    ((analisis, graficas) | None, advertencias). Debe llamarse con
    _LOCK_GRAFICOS tomado (genera graficas con matplotlib)."""
    if not ctx.ruta_meteo:
        return None, []
    try:
        registros, advertencias = meteorologia.leer_datos_meteorologicos(ctx.ruta_meteo)
    except meteorologia.ErrorMeteorologia as exc:
        return None, [str(exc)]
    dias, intervalos = meteorologia.fechas_de_medicion(resultados)
    if not dias:
        return None, advertencias + [
            "Datos meteorologicos: no se pudieron determinar las fechas de medicion a partir de las memorias."]
    analisis = meteorologia.analizar(registros, dias, intervalos)
    if analisis is None:
        fechas = ", ".join(d.strftime("%d/%m/%Y") for d in sorted(dias))
        return None, advertencias + [
            f"Datos meteorologicos: el archivo no tiene registros validos para los dias de medicion ({fechas}); "
            "el capitulo de meteorologia de la plantilla no se modifico."]
    graficas = meteorologia.generar_graficas_meteo(analisis, carpeta)
    return (analisis, graficas), advertencias + analisis.advertencias


def generar_anexos(ctx: Contexto, elaborado_por: str = "") -> Entregable:
    resultados = procesar(ctx)
    carpeta = os.path.join(ctx.carpeta, "anexos")
    os.makedirs(carpeta, exist_ok=True)
    with _LOCK_GRAFICOS:
        graficas = generar_graficas(resultados, carpeta)
        isofonas, errores = _generar_isofonas(ctx, resultados, carpeta, elaborado_por, con_titulo=True)
        meteo, avisos_meteo = _meteorologia(ctx, resultados, os.path.join(carpeta, "meteorologia"))
    errores += avisos_meteo

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for ruta in graficas.values():
            if ruta:
                zf.write(ruta, f"graficas/{os.path.basename(ruta)}")
        for ruta in isofonas.values():
            zf.write(ruta, f"isofonas/{os.path.basename(ruta)}")
            pdf = os.path.splitext(ruta)[0] + ".pdf"
            if os.path.exists(pdf):
                zf.write(pdf, f"isofonas/{os.path.basename(pdf)}")
        if meteo:
            for ruta in meteo[1].values():
                zf.write(ruta, f"meteorologia/{os.path.basename(ruta)}")
    if not any(graficas.values()) and not isofonas:
        errores.append("No hay resultados suficientes para generar graficas ni mapas de isofonas.")
    return Entregable(buffer.getvalue(), f"{_nombre_base(ctx)} - Graficas e isofonas.zip",
                      "application/zip", errores)


def generar_word(ctx: Contexto, ruta_plantilla: Optional[str], equipos: list[EquipoIn],
                 elaborado_por: str = "") -> Entregable:
    resultados = procesar(ctx)
    carpeta = os.path.join(ctx.carpeta, "informe")
    os.makedirs(carpeta, exist_ok=True)
    with _LOCK_GRAFICOS:
        graficas = generar_graficas(resultados, carpeta)
        isofonas, errores_isofonas = _generar_isofonas(ctx, resultados, carpeta, elaborado_por, con_titulo=False)
        meteo, avisos_meteo = _meteorologia(ctx, resultados, os.path.join(carpeta, "meteorologia"))

    ruta_equipos = None
    if equipos:
        ruta_equipos = os.path.join(ctx.carpeta, "equipos.json")
        with open(ruta_equipos, "w", encoding="utf-8") as f:
            json.dump([e.model_dump() for e in equipos], f, ensure_ascii=False)

    salida = os.path.join(ctx.carpeta, "informe.docx")
    try:
        _, faltantes = generar_informe(
            resultados, ruta_plantilla or PLANTILLA_DEFECTO, salida,
            graficas=graficas, isofonas=isofonas, ruta_equipos=ruta_equipos, meteo=meteo,
        )
    except ErrorPlantilla as exc:
        raise ErrorEntrada(str(exc)) from exc
    with open(salida, "rb") as f:
        contenido = f.read()
    advertencias = [a.mensaje for a in resultados.advertencias]
    advertencias += [f"Tabla no encontrada en la plantilla: {t}" for t in faltantes]
    advertencias += errores_isofonas
    advertencias += avisos_meteo
    return Entregable(contenido, f"{_nombre_base(ctx)} - Informe.docx", MIME_DOCX, advertencias)
