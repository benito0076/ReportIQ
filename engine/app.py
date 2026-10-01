"""API HTTP del motor de calculo de ruido ambiental (Res. 0627).

La usa la aplicacion web (carpeta web/) desde su servidor; no esta pensada
para llamarse desde el navegador. Toda peticion (salvo /health) requiere la
cabecera `Authorization: Bearer <ENGINE_API_KEY>`.

    GET  /health        estado del servicio
    GET  /v1/sectores   tabla de sectores de la Res. 0627 (Anexo 3)
    POST /v1/procesar   procesa el proyecto y devuelve los resultados (JSON)
    POST /v1/generar    genera un entregable (excel | word | anexos) y lo
                        devuelve como archivo; las advertencias van en la
                        cabecera X-Advertencias (JSON codificado como URL)
    POST /v1/aire/procesar  calidad del aire (Res. 2254): resultados (JSON)
    POST /v1/aire/generar   calidad del aire: entregable (excel | word)
"""
from __future__ import annotations

import hmac
import json
import logging
import multiprocessing
import os
import tempfile
import threading
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from urllib.parse import quote

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response

from core import norms

from .errores import ErrorDescarga, ErrorEntrada
from .schemas import GenerarAireIn, GenerarIn, ProcesarAireIn, ProcesarIn

# Los avisos de core/ (p.ej. fallo del mapa satelital) salen en los logs del servicio.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("engine")

app = FastAPI(title="Motor de ruido ambiental (Res. 0627)", docs_url=None, redoc_url=None)


def verificar_clave(authorization: str = Header(default="")):
    esperada = os.environ.get("ENGINE_API_KEY", "")
    if not esperada:
        raise HTTPException(503, "ENGINE_API_KEY no esta configurada en el motor.")
    recibida = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(recibida.encode(), esperada.encode()):
        raise HTTPException(401, "Clave de API invalida.")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/v1/sectores", dependencies=[Depends(verificar_clave)])
def sectores():
    return [
        {"etiqueta": s.etiqueta, "sector": s.sector, "subsector": s.subsector, "dia": s.dia, "noche": s.noche}
        for s in norms.TABLA_RES_0627
    ]


# --------------------------------------------------------------- aislamiento
# Cada trabajo pesado (procesar o generar) corre en un proceso hijo que termina
# al acabar: Python no devuelve al sistema la memoria de openpyxl, matplotlib y
# python-docx, y en el plan de 512 MB los trabajos sucesivos acababan matando el
# servicio. El proceso del servidor ni siquiera importa core/ (~90 MB): el hijo
# sale de un "forkserver" con los modulos ya importados (rapido y seguro con
# hilos), y solo corre un trabajo a la vez por proceso del servidor.
_TRABAJOS = threading.Semaphore(int(os.environ.get("ENGINE_TRABAJOS", "1")))
_MP = multiprocessing.get_context("forkserver")
_MP.set_forkserver_preload(["engine.service", "core.aire", "core.informe_aire", "core.report_generator"])


def _aislado(fn, *args):
    if os.environ.get("ENGINE_AISLAR", "1") == "0":
        return fn(*args)
    with _TRABAJOS:
        try:
            with ProcessPoolExecutor(max_workers=1, mp_context=_MP) as pool:
                return pool.submit(fn, *args).result()
        except BrokenProcessPool as exc:
            log.error("El proceso del trabajo termino de forma inesperada (memoria insuficiente?)")
            raise HTTPException(503, "El motor se quedó sin memoria con este proyecto. Intente de nuevo; si "
                                     "persiste, reduzca el número de estaciones por informe.") from exc


def _errores(fn, *args):
    try:
        return _aislado(fn, *args)
    except ErrorDescarga as exc:
        raise HTTPException(502, str(exc)) from exc
    except ErrorEntrada as exc:
        raise HTTPException(422, str(exc)) from exc


def _trabajo_procesar(proyecto):
    from . import service  # core/ solo se importa en el proceso de trabajo

    with tempfile.TemporaryDirectory(prefix="ruido_") as carpeta:
        ctx, _ = service.preparar(proyecto, carpeta)
        return service.resultados_a_dict(service.procesar(ctx))


def _trabajo_generar(body: GenerarIn):
    from . import service  # core/ solo se importa en el proceso de trabajo

    with tempfile.TemporaryDirectory(prefix="ruido_") as carpeta:
        ctx, ruta_plantilla = service.preparar(body.proyecto, carpeta, body.plantilla)
        if body.tipo == "excel":
            return service.generar_excel(ctx)
        if body.tipo == "anexos":
            return service.generar_anexos(ctx, body.elaborado_por)
        return service.generar_word(ctx, ruta_plantilla, body.equipos, body.elaborado_por)


def _trabajo_procesar_aire(proyecto):
    from . import service  # core/ solo se importa en el proceso de trabajo

    with tempfile.TemporaryDirectory(prefix="aire_") as carpeta:
        return service.aire_a_dict(service.procesar_aire(service.preparar_aire(proyecto, carpeta)))


def _trabajo_generar_aire(body: GenerarAireIn):
    from . import service  # core/ solo se importa en el proceso de trabajo

    with tempfile.TemporaryDirectory(prefix="aire_") as carpeta:
        ctx = service.preparar_aire(body.proyecto, carpeta)
        return service.generar_word_aire(ctx) if body.tipo == "word" else service.generar_excel_aire(ctx)


# --------------------------------------------------------------- rutas
@app.post("/v1/procesar", dependencies=[Depends(verificar_clave)])
def procesar(body: ProcesarIn):
    return _errores(_trabajo_procesar, body.proyecto)


def _respuesta_archivo(entregable) -> Response:
    return Response(
        content=entregable.contenido,
        media_type=entregable.content_type,
        headers={
            "X-Nombre-Archivo": quote(entregable.nombre_archivo),
            "X-Advertencias": quote(json.dumps(entregable.advertencias, ensure_ascii=False)),
        },
    )


@app.post("/v1/aire/procesar", dependencies=[Depends(verificar_clave)])
def procesar_aire(body: ProcesarAireIn):
    return _errores(_trabajo_procesar_aire, body.proyecto)


@app.post("/v1/aire/generar", dependencies=[Depends(verificar_clave)])
def generar_aire(body: GenerarAireIn):
    return _respuesta_archivo(_errores(_trabajo_generar_aire, body))


@app.post("/v1/generar", dependencies=[Depends(verificar_clave)])
def generar(body: GenerarIn):
    return _respuesta_archivo(_errores(_trabajo_generar, body))
