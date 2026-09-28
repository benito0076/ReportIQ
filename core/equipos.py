"""Inventario de equipos de medicion (sonometros) de la empresa: relaciona el
numero de serie leido de cada memoria con el nombre/codigo interno del
equipo, para diligenciar automaticamente la tabla 'Equipos de medicion' del
informe.

El inventario por defecto (sembrado con los equipos informados por el
usuario) se guarda en 'equipos.json' junto a la aplicacion, y se puede
editar libremente -agregando o quitando equipos- sin tocar el codigo: basta
con editar ese archivo (o la lista desde la interfaz, si se agrega mas
adelante)."""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict
from typing import Optional

DEFAULT_EQUIPOS = [
    {"nombre": "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", "codigo": "612-C", "serial": "0006599"},
    {"nombre": "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", "codigo": "750-C", "serial": "0007214"},
    {"nombre": "Sonometro LARSON DAVIS SOUND EXPERT 821", "codigo": "825-C", "serial": "40034"},
    {"nombre": "Sonometro LARSON DAVIS SOUND EXPERT 821", "codigo": "824-C", "serial": "40013"},
    {"nombre": "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", "codigo": "617-C", "serial": "0006973"},
    {"nombre": "Sonometro LARSON DAVIS Modelo SoundTrack LxT1", "codigo": "713-C", "serial": "0007215"},
    {"nombre": "Sonometro LARSON DAVIS SOUND EXPERT 821", "codigo": "1014-C", "serial": "40798"},
    {"nombre": "Sonometro LARSON DAVIS SOUND EXPERT 821", "codigo": "1016-C", "serial": "40799"},
]


@dataclass
class Equipo:
    nombre: str
    codigo: str
    serial: str


def normalizar_serial(serial) -> str:
    """Normaliza un numero de serie para comparar equipos indistintamente de
    ceros a la izquierda o de que venga como texto o numero (p.ej. 6599,
    '6599' y '0006599' deben considerarse el mismo serial)."""
    if serial is None:
        return ""
    texto = str(serial).strip()
    solo_digitos = re.sub(r"\D", "", texto)
    if solo_digitos:
        return solo_digitos.lstrip("0") or "0"
    return texto.lower()


def cargar_equipos(ruta: Optional[str] = None) -> list:
    """Carga el inventario de equipos desde `ruta` (JSON); si no existe o no
    se indica, devuelve el inventario por defecto."""
    if ruta and os.path.exists(ruta):
        with open(ruta, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [Equipo(**e) for e in data]
    return [Equipo(**e) for e in DEFAULT_EQUIPOS]


def guardar_equipos(equipos: list, ruta: str):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump([asdict(e) for e in equipos], f, ensure_ascii=False, indent=2)


def buscar_por_serial(equipos: list, serial) -> Optional[Equipo]:
    objetivo = normalizar_serial(serial)
    if not objetivo:
        return None
    for e in equipos:
        if normalizar_serial(e.serial) == objetivo:
            return e
    return None
