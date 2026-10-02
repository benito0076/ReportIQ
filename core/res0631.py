"""Resolucion 0631 de 2015: limites por actividad y declaracion de conformidad.

    limite(actividad, parametro, alcantarillado)  -> Limite de la norma
    evaluar(resultado, limite, ...)               -> "Cumple" / "No cumple" / None (sin juicio normativo)

Regla de decision: aceptacion simple (W = 0, ILAC-G8:09/2019), como en los
informes de Ambienciq: cumple si el valor medido no supera el limite.
Un resultado "<LCM" cumple si el LCM no supera el limite.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from . import res0631_datos as datos

ACTIVIDADES = {a["clave"]: a for a in datos.ACTIVIDADES}

# Parametro del laboratorio -> parametro de la resolucion.
_EQUIVALENCIAS = {
    "ph_max": "ph", "ph_min": "ph",
    "solidos_sedimentables_max": "solidos_sedimentables", "solidos_sedimentables_min": "solidos_sedimentables",
    "color_436": "color", "color_525": "color", "color_620": "color",
    "grasas_aceites": "aceites_grasas", "hidrocarburos": "hidrocarburos_totales",
}


def parametro_norma(clave: str) -> str:
    if clave.startswith("hap_"):
        return "hap"
    return _EQUIVALENCIAS.get(clave, clave)


@dataclass(frozen=True)
class Limite:
    tipo: str  # "max", "rango", "ayr" (analisis y reporte) o "ne" (no establecido)
    texto: str  # como se presenta en el informe
    maximo: Optional[float] = None
    minimo: Optional[float] = None
    ajustado: bool = False  # multiplicado por 1,50 (Art. 16)
    nota: str = ""
    marca: str = ""  # "*" (Art. 16: x 1,50) o "**" (Art. 16: mismas exigencias de la actividad)

    @property
    def con_juicio(self) -> bool:
        return self.tipo in ("max", "rango")


NE = Limite("ne", "N.E.")
AYR = Limite("ayr", "Análisis y Reporte")


def numero(texto: str) -> float:
    return float(texto.replace(".", "").replace(",", "."))


def fmt_limite(v: float) -> str:
    """Numero con el formato de la resolucion (coma decimal, al menos 2 decimales)."""
    txt = f"{v:,.4f}".rstrip("0")
    entero, _, dec = txt.partition(".")
    dec = (dec + "00")[:max(2, len(dec))]
    return entero.replace(",", ".") + "," + dec


def _desde_texto(texto: str) -> Limite:
    if texto == datos.AYR:
        return AYR
    m = re.fullmatch(r"\s*([\d.,]+)\s*a\s*([\d.,]+)\s*", texto)
    if m:
        return Limite("rango", texto, maximo=numero(m.group(2)), minimo=numero(m.group(1)))
    return Limite("max", texto, maximo=numero(texto))


def limite(actividad: str, parametro: str, alcantarillado: bool = False, consumo_humano: bool = False) -> Limite:
    """Limite de la resolucion para el parametro (clave del laboratorio o de la norma) en la actividad.
    `alcantarillado`: aplica el Art. 16; `consumo_humano`: paragrafo de HAP <= 0,01 mg/L."""
    p = parametro_norma(parametro)
    if p in ("temperatura_max", "temperatura_min", "temperatura"):
        return Limite("max", fmt_limite(datos.TEMPERATURA_MAXIMA), maximo=datos.TEMPERATURA_MAXIMA,
                      nota="Artículo 5 de la Resolución 0631 de 2015.")
    act = ACTIVIDADES.get(actividad)
    if act is None:
        raise KeyError(f"Actividad desconocida: {actividad}")
    texto = act["valores"].get(p)
    if texto is None:
        return NE
    lim = _desde_texto(texto)
    nota = datos.NOTAS.get((actividad, p), "")
    if p == "hap" and lim.tipo == "ayr" and consumo_humano:
        lim = Limite("max", fmt_limite(datos.HAP_CONSUMO_HUMANO), maximo=datos.HAP_CONSUMO_HUMANO,
                     nota="Receptor con uso para consumo humano y doméstico, y pecuario.")
    if alcantarillado:
        if p not in datos.PARAMETROS_ALCANTARILLADO:
            return NE
        if p == "ph":
            return _desde_texto(datos.PH_ALCANTARILLADO)
        if p in datos.MULTIPLICADOS_ALCANTARILLADO:
            if lim.tipo == "max":
                v = lim.maximo * datos.FACTOR_ALCANTARILLADO
                return Limite("max", fmt_limite(v), maximo=v, ajustado=True, nota=nota, marca="*")
            return Limite(lim.tipo, lim.texto, lim.maximo, lim.minimo, True, nota, marca="*")
        return Limite(lim.tipo, lim.texto, lim.maximo, lim.minimo, False, nota, marca="**")
    return Limite(lim.tipo, lim.texto, lim.maximo, lim.minimo, lim.ajustado, nota) if nota else lim


def texto_limite(parametro: str, lim: Limite) -> str:
    """Texto para la fila del parametro: el pH maximo muestra el extremo superior del rango y el minimo el
    inferior (como en los informes); "N.E." cuando la norma no lo establece."""
    if lim.tipo == "rango" and parametro in ("ph_max", "ph_min"):
        return fmt_limite(lim.maximo if parametro == "ph_max" else lim.minimo)
    return lim.texto


def evaluar(parametro: str, valor: Optional[float], menor_que_lcm: bool, lim: Limite) -> Optional[str]:
    """Declaracion de conformidad del resultado frente al limite; None si no aplica juicio normativo.
    Para pH: el pH maximo se compara con el extremo superior del rango y el minimo con el inferior."""
    if valor is None or not lim.con_juicio:
        return None
    if lim.tipo == "rango":
        if parametro == "ph_min":
            return "Cumple" if valor >= lim.minimo else "No cumple"
        if parametro == "ph_max":
            return "Cumple" if valor <= lim.maximo else "No cumple"
        return "Cumple" if lim.minimo <= valor <= lim.maximo else "No cumple"
    # "<LCM": el valor real es menor que el LCM.
    if menor_que_lcm:
        return "Cumple" if valor <= lim.maximo else None
    return "Cumple" if valor <= lim.maximo else "No cumple"


def nombre_columna(actividad: str, alcantarillado: bool = False) -> str:
    """Encabezado de la columna de limites, como en los informes: "Art. 12 Elaboración de alimentos..."."""
    act = ACTIVIDADES[actividad]
    base = f"Art. {act['articulo']} {act['actividad']}"
    return f"Art. {act['articulo']} Ajustado al Art. 16" if alcantarillado else base


def actividades_por_articulo() -> list[dict]:
    """Catalogo para la interfaz: [{articulo, sector, actividades: [{clave, actividad}]}]."""
    grupos: dict[int, dict] = {}
    for a in datos.ACTIVIDADES:
        g = grupos.setdefault(a["articulo"], {"articulo": a["articulo"], "sector": a["sector"], "actividades": []})
        g["actividades"].append({"clave": a["clave"], "actividad": a["actividad"]})
    return list(grupos.values())
