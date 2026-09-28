"""Esquemas de entrada/salida de la API del motor de calculo."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Esquema = Literal["DH", "DNH", "NDH", "NDNH"]
Direccion = Literal["Vertical", "Norte", "Sur", "Este", "Oeste"]


class ArchivoRemoto(BaseModel):
    """Archivo que el motor descarga (URL firmada de corta duracion)."""
    url: str
    nombre: str = ""


class CorreccionManual(BaseModel):
    esquema: Esquema
    direccion: Direccion
    KS: float = 0.0
    pantalla: float = 0.0


class PuntoIn(BaseModel):
    no_punto: int
    nombre: str
    sector: str = ""
    este: str = ""  # Este (Origen Nacional, m) o Longitud (grados)
    norte: str = ""  # Norte (Origen Nacional, m) o Latitud (grados)
    incertidumbre: float = 0.0
    altitud: str = ""
    descripcion: str = ""
    foto: Optional[ArchivoRemoto] = None
    # esquema -> direccion -> archivo de memoria del sonometro (.xlsx)
    memorias: dict[Esquema, dict[Direccion, ArchivoRemoto]] = Field(default_factory=dict)
    correcciones_manuales: list[CorreccionManual] = Field(default_factory=list)


class ProyectoIn(BaseModel):
    nombre_proyecto: str = ""
    codigo_informe: str = ""
    cliente: str = ""
    puntos: list[PuntoIn] = Field(default_factory=list)
    # Archivo de la estacion meteorologica (.xlsx); opcional.
    meteorologia: Optional[ArchivoRemoto] = None


class EquipoIn(BaseModel):
    nombre: str
    codigo: str = ""
    serial: str


class ProcesarIn(BaseModel):
    proyecto: ProyectoIn


class GenerarIn(BaseModel):
    proyecto: ProyectoIn
    tipo: Literal["excel", "word", "anexos"]
    plantilla: Optional[ArchivoRemoto] = None  # si no se indica, se usa la plantilla incluida
    equipos: list[EquipoIn] = Field(default_factory=list)
    elaborado_por: str = ""
