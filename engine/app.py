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
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import tempfile
from urllib.parse import quote

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response

from core import norms

from . import service
from .schemas import GenerarIn, ProcesarIn

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


@app.post("/v1/procesar", dependencies=[Depends(verificar_clave)])
def procesar(body: ProcesarIn):
    with tempfile.TemporaryDirectory(prefix="ruido_") as carpeta:
        try:
            ctx, _ = service.preparar(body.proyecto, carpeta)
        except service.ErrorDescarga as exc:
            raise HTTPException(502, str(exc)) from exc
        resultados = service.procesar(ctx)
        return service.resultados_a_dict(resultados)


@app.post("/v1/generar", dependencies=[Depends(verificar_clave)])
def generar(body: GenerarIn):
    with tempfile.TemporaryDirectory(prefix="ruido_") as carpeta:
        try:
            ctx, ruta_plantilla = service.preparar(body.proyecto, carpeta, body.plantilla)
            if body.tipo == "excel":
                entregable = service.generar_excel(ctx)
            elif body.tipo == "anexos":
                entregable = service.generar_anexos(ctx, body.elaborado_por)
            else:
                entregable = service.generar_word(ctx, ruta_plantilla, body.equipos, body.elaborado_por)
        except service.ErrorDescarga as exc:
            raise HTTPException(502, str(exc)) from exc
        except service.ErrorEntrada as exc:
            raise HTTPException(422, str(exc)) from exc

    return Response(
        content=entregable.contenido,
        media_type=entregable.content_type,
        headers={
            "X-Nombre-Archivo": quote(entregable.nombre_archivo),
            "X-Advertencias": quote(json.dumps(entregable.advertencias, ensure_ascii=False)),
        },
    )
