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
    fuentes: str = ""  # fuentes de ruido percibidas en el punto (capitulo del informe)
    foto_ruta: str = ""
    # esquema -> {direccion -> ArchivoMemoria}
    archivos: dict = field(default_factory=lambda: {e: {d: ArchivoMemoria(d) for d in DIRECCIONES} for e in ESQUEMAS})
    # correcciones manuales opcionales por esquema/direccion: {(esquema,direccion): {"KS":0,"pantalla":0}}
    correcciones_manuales: dict = field(default_factory=dict)

    def esquemas_activos(self):
        return [e for e in ESQUEMAS if any(a.ruta for a in self.archivos.get(e, {}).values())]


@dataclass
class DatosInforme:
    """Datos del informe Word que no salen de las mediciones: se usan para
    redactar el resumen, los objetivos, la informacion del cliente, el
    encabezado, la portada y el cuadro de control del documento."""
    # Como se nombra el sitio en el texto, p. ej. "el área de actividades de
    # la Gerencia General de Activos con Socios, específicamente en el Campo Colorado".
    area_estudio: str = ""
    municipio: str = ""
    departamento: str = ""
    # Titulo de la portada y del encabezado (una linea por renglon).
    titulo: str = ""
    expediente: str = ""
    # Resoluciones del acto administrativo (encabezado del informe de calidad del aire).
    acto_administrativo: str = ""
    version: str = "1.0"
    fecha: str = ""  # AAAA-MM-DD; vacio = fecha en que se genera el informe
    cliente_nit: str = ""
    cliente_direccion: str = ""
    cliente_contacto: str = ""
    cliente_ciudad: str = ""
    cliente_departamento: str = ""
    cliente_actividad: str = ""
    # Vertimientos: laboratorio de los ensayos subcontratados, p. ej. "WR S.A.S.".
    laboratorio_subcontratado: str = ""
    elaboro_nombre: str = ""
    elaboro_cargo: str = ""
    autorizo_nombre: str = ""
    autorizo_cargo: str = ""


@dataclass
class Proyecto:
    nombre_proyecto: str = ""
    codigo_informe: str = ""
    cliente: str = ""
    puntos: list = field(default_factory=list)
    # "ambiental" (5 direcciones por punto y jornada) o "emision" (medicion
    # con la fuente en operacion y, opcional, ruido residual; ver core/emision.py).
    tipo: str = "ambiental"
    meteo_ruta: str = ""  # archivo de la estacion meteorologica (.xlsx), opcional
    informe: DatosInforme = field(default_factory=DatosInforme)
    barrido: list = field(default_factory=list)  # [core.emision.ItemBarrido], solo emision

    def agregar_punto(self, nombre: str, sector: str = "") -> Punto:
        no = len(self.puntos) + 1
        p = Punto(no_punto=no, nombre=nombre, sector=sector)
        self.puntos.append(p)
        return p
