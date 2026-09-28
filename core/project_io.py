"""Guardar y cargar un Proyecto (puntos, archivos asignados, sectores) como
JSON, para poder retomar el trabajo entre sesiones de la aplicacion."""
from __future__ import annotations

import json
from dataclasses import asdict, fields

from .models import DIRECCIONES, ESQUEMAS, ArchivoMemoria, DatosInforme, Proyecto, Punto


def proyecto_a_dict(proyecto: Proyecto) -> dict:
    return {
        "nombre_proyecto": proyecto.nombre_proyecto,
        "codigo_informe": proyecto.codigo_informe,
        "cliente": proyecto.cliente,
        "meteo_ruta": proyecto.meteo_ruta,
        "informe": asdict(proyecto.informe),
        "puntos": [
            {
                "no_punto": p.no_punto,
                "nombre": p.nombre,
                "sector": p.sector,
                "longitud": p.longitud,
                "latitud": p.latitud,
                "incertidumbre": p.incertidumbre,
                "altitud": p.altitud,
                "descripcion": p.descripcion,
                "fuentes": p.fuentes,
                "foto_ruta": p.foto_ruta,
                "archivos": {
                    esquema: {d: p.archivos[esquema][d].ruta for d in DIRECCIONES}
                    for esquema in ESQUEMAS
                },
                "correcciones_manuales": {
                    f"{esquema}|{direccion}": valores
                    for (esquema, direccion), valores in p.correcciones_manuales.items()
                },
            }
            for p in proyecto.puntos
        ],
    }


def dict_a_proyecto(data: dict) -> Proyecto:
    proyecto = Proyecto(
        nombre_proyecto=data.get("nombre_proyecto", ""),
        codigo_informe=data.get("codigo_informe", ""),
        cliente=data.get("cliente", ""),
        meteo_ruta=data.get("meteo_ruta", ""),
        informe=datos_informe_desde_dict(data.get("informe")),
    )
    for pd in data.get("puntos", []):
        punto = Punto(
            no_punto=pd["no_punto"], nombre=pd["nombre"], sector=pd.get("sector", ""),
            longitud=pd.get("longitud", ""), latitud=pd.get("latitud", ""),
            incertidumbre=pd.get("incertidumbre", 0.0),
            altitud=pd.get("altitud", ""), descripcion=pd.get("descripcion", ""),
            fuentes=pd.get("fuentes", ""),
            foto_ruta=pd.get("foto_ruta", ""),
        )
        archivos_data = pd.get("archivos", {})
        for esquema in ESQUEMAS:
            for direccion in DIRECCIONES:
                ruta = archivos_data.get(esquema, {}).get(direccion)
                punto.archivos[esquema][direccion] = ArchivoMemoria(direccion, ruta)
        for clave, valores in pd.get("correcciones_manuales", {}).items():
            esquema, direccion = clave.split("|", 1)
            punto.correcciones_manuales[(esquema, direccion)] = valores
        proyecto.puntos.append(punto)
    return proyecto


def datos_informe_desde_dict(data) -> DatosInforme:
    """Crea DatosInforme ignorando claves desconocidas (archivos de otras versiones)."""
    validos = {f.name for f in fields(DatosInforme)}
    return DatosInforme(**{k: str(v or "") for k, v in (data or {}).items() if k in validos})


def guardar_proyecto(proyecto: Proyecto, ruta: str):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(proyecto_a_dict(proyecto), f, ensure_ascii=False, indent=2)


def cargar_proyecto(ruta: str) -> Proyecto:
    with open(ruta, "r", encoding="utf-8") as f:
        data = json.load(f)
    return dict_a_proyecto(data)
