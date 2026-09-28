"""Estandares maximos permisibles de niveles de ruido ambiental,
Resolucion 0627 de 2006 (Colombia), Anexo 3 (tabla de sectores y subsectores).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SectorNorma:
    sector: str
    subsector: str
    dia: int
    noche: int

    @property
    def etiqueta(self) -> str:
        return f"{self.sector} - {self.subsector}"


TABLA_RES_0627 = [
    SectorNorma("A", "Tranquilidad y silencio - Hospitales, bibliotecas, guarderias, sanatorios, hogares geriatricos", 55, 45),
    SectorNorma("B", "Tranquilidad y ruido moderado - Zonas residenciales o exclusivamente destinadas para desarrollo habitacional, hoteleria y hospedajes.", 65, 50),
    SectorNorma("B", "Tranquilidad y ruido moderado - Universidades, colegios, escuelas, centros de estudio e investigacion.", 65, 50),
    SectorNorma("B", "Tranquilidad y ruido moderado - Parques en zonas urbanas, diferentes a los parques mecanicos al aire libre.", 65, 50),
    SectorNorma("C", "Ruido Intermedio Restringido - Zonas con usos permitidos industriales, como industrias en general, zonas portuarias, parques industriales, zonas francas.", 75, 70),
    SectorNorma("C", "Ruido Intermedio Restringido - Zonas con usos permitidos comerciales, como centros comerciales, almacenes, locales o instalaciones de tipo comercial, talleres de mecanica automotriz e industrial, centros deportivos y recreativos, gimnasios, restaurantes, bares, tabernas, discotecas, bingos, casinos.", 70, 55),
    SectorNorma("C", "Ruido Intermedio Restringido - Zonas con usos permitidos de oficinas.", 65, 50),
    SectorNorma("C", "Ruido Intermedio Restringido - Zonas con usos institucionales.", 65, 50),
    SectorNorma("C", "Ruido Intermedio Restringido - Zonas con otros usos relacionados, como parques mecanicos al aire libre, areas destinadas a espectaculos publicos al aire libre, vias troncales, autopistas, vias arterias, vias principales.", 80, 70),
    SectorNorma("D", "Zona suburbana o rural de tranquilidad y ruido moderado - Residencial suburbana", 55, 45),
    SectorNorma("D", "Zona suburbana o rural de tranquilidad y ruido moderado - Rural Habitada destinada a explotacion agropecuaria.", 55, 45),
    SectorNorma("D", "Zona suburbana o rural de tranquilidad y ruido moderado - Zonas de recreacion y descanso, como parques naturales y reservas naturales", 55, 45),
]


def opciones_sector():
    """Lista de etiquetas legibles para el combo de seleccion de sector."""
    return [s.etiqueta for s in TABLA_RES_0627]


def buscar_sector(etiqueta: str) -> SectorNorma | None:
    for s in TABLA_RES_0627:
        if s.etiqueta == etiqueta:
            return s
    return None


def estandar_diurno(etiqueta: str):
    s = buscar_sector(etiqueta)
    return s.dia if s else None


def estandar_nocturno(etiqueta: str):
    s = buscar_sector(etiqueta)
    return s.noche if s else None


def cumple(nivel, estandar):
    """Replica la formula original: Cumple = 'Si' si el estandar es
    estrictamente mayor que el nivel medido (empate cuenta como 'No')."""
    if nivel is None or estandar is None:
        return None
    return "Si" if estandar > nivel else "No"
