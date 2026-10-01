"""Esquemas de entrada/salida de la API del motor de calculo."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Esquema = Literal["DH", "DNH", "NDH", "NDNH"]
# Ambiental: 5 direcciones. Emision: la medicion con la fuente en operacion y,
# opcional, el ruido residual (fuente apagada).
Direccion = Literal["Vertical", "Norte", "Sur", "Este", "Oeste", "Emision", "Residual"]


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
    fuentes: str = ""  # fuentes de ruido percibidas (capitulo del informe)
    foto: Optional[ArchivoRemoto] = None
    # esquema -> direccion -> archivo de memoria del sonometro (.xlsx)
    memorias: dict[Esquema, dict[Direccion, ArchivoRemoto]] = Field(default_factory=dict)
    correcciones_manuales: list[CorreccionManual] = Field(default_factory=list)


class InformeIn(BaseModel):
    """Datos para redactar el informe Word (ver core.models.DatosInforme)."""
    area_estudio: str = ""
    municipio: str = ""
    departamento: str = ""
    titulo: str = ""
    expediente: str = ""
    acto_administrativo: str = ""
    version: str = "1.0"
    fecha: str = ""
    cliente_nit: str = ""
    cliente_direccion: str = ""
    cliente_contacto: str = ""
    cliente_ciudad: str = ""
    cliente_departamento: str = ""
    cliente_actividad: str = ""
    elaboro_nombre: str = ""
    elaboro_cargo: str = ""
    autorizo_nombre: str = ""
    autorizo_cargo: str = ""


class BarridoIn(BaseModel):
    """Memoria de 2 minutos del barrido perimetral (solo emision)."""
    nombre: str
    condicion: Literal["Encendido", "Apagado"] = "Encendido"
    seleccionado: bool = False
    archivo: ArchivoRemoto


class ProyectoIn(BaseModel):
    tipo: Literal["ambiental", "emision"] = "ambiental"
    nombre_proyecto: str = ""
    codigo_informe: str = ""
    cliente: str = ""
    puntos: list[PuntoIn] = Field(default_factory=list)
    informe: InformeIn = Field(default_factory=InformeIn)
    barrido: list[BarridoIn] = Field(default_factory=list)
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


# ------------------------------------------------------------ calidad del aire
PlantillaAire = Literal["PM10", "PM2.5", "SO2", "COV", "AUTOMATICOS"]


class EstacionAireIn(BaseModel):
    numero: int  # hoja CA-n / ESTACION n de las plantillas
    nombre: str = ""
    codigo: str = ""
    codigo_anla: str = ""
    longitud: str = ""
    latitud: str = ""
    descripcion: str = ""
    foto: Optional[ArchivoRemoto] = None


class ProyectoAireIn(BaseModel):
    nombre_proyecto: str = ""
    codigo: str = ""
    cliente: str = ""
    estaciones: list[EstacionAireIn] = Field(default_factory=list)
    # Plantillas FP diligenciadas: PM10 (FP-031), PM2.5 (FP-032), SO2 (FP-033),
    # COV (FP-035) y AUTOMATICOS (FP-021: CO, NO2, O3).
    plantillas: dict[PlantillaAire, ArchivoRemoto] = Field(default_factory=dict)
    meteorologia: Optional[ArchivoRemoto] = None
    informe: InformeIn = Field(default_factory=InformeIn)
    # Limites de cuantificacion del laboratorio (µg) si difieren de los usuales.
    limites_cuantificacion: dict[str, float] = Field(default_factory=dict)


class ProcesarAireIn(BaseModel):
    proyecto: ProyectoAireIn


class GenerarAireIn(BaseModel):
    proyecto: ProyectoAireIn
    tipo: Literal["excel", "word"] = "excel"
