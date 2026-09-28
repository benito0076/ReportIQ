"""Modelos de datos del proyecto de ruido ambiental."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

DIRECCIONES = ["Vertical", "Norte", "Sur", "Este", "Oeste"]
JORNADAS = ["Diurno", "Nocturno"]
TIPOS_DIA = ["Habil", "No Habil"]

# Combinaciones de jornada usadas como hojas en la matriz de procesamiento.
ESQUEMAS = ["DH", "DNH", "NDH", "NDNH"]
ESQUEMA_LABELS = {
    "DH": "Diurno - Dia Habil",
    "DNH": "Diurno - Dia No Habil",
    "NDH": "Nocturno - Dia Habil",
    "NDNH": "Nocturno - Dia No Habil",
}


@dataclass
class ArchivoMemoria:
    """Referencia a un archivo de memoria del sonometro para una direccion dada."""
    direccion: str
    ruta: Optional[str] = None


@dataclass
class Punto:
    """Punto de monitoreo de ruido ambiental."""
    no_punto: int
    nombre: str
    sector: str = ""
    longitud: str = ""  # Coordenada Este (Origen Nacional, m) o Longitud (grados)
    latitud: str = ""  # Coordenada Norte (Origen Nacional, m) o Latitud (grados)
    incertidumbre: float = 0.0
    altitud: str = ""  # m.s.n.m., opcional
    descripcion: str = ""
    foto_ruta: str = ""
    # esquema -> {direccion -> ArchivoMemoria}
    archivos: dict = field(default_factory=lambda: {e: {d: ArchivoMemoria(d) for d in DIRECCIONES} for e in ESQUEMAS})
    # correcciones manuales opcionales por esquema/direccion: {(esquema,direccion): {"KS":0,"pantalla":0}}
    correcciones_manuales: dict = field(default_factory=dict)

    def esquemas_activos(self):
        activos = []
        for esquema in ESQUEMAS:
            if any(self.archivos[esquema][d].ruta for d in DIRECCIONES):
                activos.append(esquema)
        return activos


@dataclass
class Proyecto:
    nombre_proyecto: str = ""
    codigo_informe: str = ""
    cliente: str = ""
    puntos: list = field(default_factory=list)

    def agregar_punto(self, nombre: str, sector: str = "") -> Punto:
        no = len(self.puntos) + 1
        p = Punto(no_punto=no, nombre=nombre, sector=sector)
        self.puntos.append(p)
        return p
