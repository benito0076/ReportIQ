"""Tablas de la Resolucion 0631 de 2015 (MADS), transcritas de la version firmada.

Cada actividad es una columna de las tablas de los articulos 8 a 15: parametro ->
valor tal como aparece en la resolucion:
    "6,00 a 9,00"   rango (pH)
    "200,00"        valor limite maximo permisible
    "AyR"           Analisis y Reporte
    (ausente)       la resolucion no lo establece para esa actividad (N.E.)

Claves de parametro: las de core.vertimientos.PARAMETROS, mas los parametros que
la resolucion trata como uno solo (hap, btex, aox, compuestos_fenolicos, color,
solidos_sedimentables, fluoruros...).
"""
from __future__ import annotations

AYR = "AyR"
PH69 = "6,00 a 9,00"

# Orden de las filas en las tablas de la resolucion (para presentar la norma).
ORDEN = (
    "ph", "dqo", "dbo5", "sst", "solidos_sedimentables", "aceites_grasas", "compuestos_fenolicos", "fenoles",
    "formaldehido", "saam", "hidrocarburos_totales", "hap", "btex", "aox", "ortofosfatos", "fosforo_total", "nitratos",
    "nitritos", "nitrogeno_amoniacal", "nitrogeno_total", "cianuro", "cloruros", "fluoruros", "sulfatos",
    "sulfuros", "aluminio", "antimonio", "arsenico", "bario", "berilio", "boro", "cadmio", "zinc", "cobalto",
    "cobre", "cromo", "estano", "hierro", "litio", "manganeso", "mercurio", "molibdeno", "niquel", "plata",
    "plomo", "selenio", "titanio", "vanadio", "acidez", "alcalinidad", "dureza_calcica", "dureza_total", "color",
)


def _tabla(articulo: int, sector: str, columnas: list[tuple[str, str]], filas: dict[str, tuple]) -> list[dict]:
    """`columnas`: [(clave, nombre de la actividad)]; `filas`: parametro -> un valor por columna
    ("" = no establecido)."""
    salida = []
    for i, (clave, nombre) in enumerate(columnas):
        valores = {}
        for param, fila in filas.items():
            assert len(fila) == len(columnas), (articulo, clave, param)
            if fila[i]:
                valores[param] = fila[i]
        salida.append({"clave": clave, "articulo": articulo, "sector": sector, "actividad": nombre,
                       "valores": valores})
    return salida


def _otros(n: int) -> dict[str, tuple]:
    """Bloque "Otros parametros para analisis y reporte" (igual en casi todas las tablas)."""
    return {p: (AYR,) * n for p in ("acidez", "alcalinidad", "dureza_calcica", "dureza_total", "color")}


ACTIVIDADES: list[dict] = []

# ---------------------------------------------------------------- Articulo 8
ACTIVIDADES += _tabla(8, "Aguas residuales domésticas – ARD y de prestadores del servicio de alcantarillado", [
    ("art8_soluciones_individuales", "ARD de las soluciones individuales de saneamiento de viviendas "
                                     "unifamiliares o bifamiliares"),
    ("art8_prestadores_hasta_625", "ARD, y ARD – ARnD de los prestadores del servicio público de alcantarillado "
                                   "a cuerpos de aguas superficiales, con una carga menor o igual a 625,00 Kg/día DBO5"),
], {
    "ph": (PH69, PH69), "dqo": ("200,00", "180,00"), "dbo5": ("", "90,00"), "sst": ("100,00", "90,00"),
    "solidos_sedimentables": ("5,00", "5,00"), "aceites_grasas": ("20,00", "20,00"), "saam": ("", AYR),
    "hidrocarburos_totales": ("", AYR), "ortofosfatos": ("", AYR), "fosforo_total": ("", AYR),
    "nitratos": ("", AYR), "nitritos": ("", AYR), "nitrogeno_amoniacal": ("", AYR), "nitrogeno_total": ("", AYR),
})
ACTIVIDADES += _tabla(8, "Aguas residuales domésticas – ARD y de prestadores del servicio de alcantarillado", [
    ("art8_prestadores_625_3000", "ARD y ARnD de los prestadores del servicio público de alcantarillado, con una "
                                  "carga mayor a 625,00 Kg/día y menor o igual a 3.000,00 Kg/día DBO5"),
    ("art8_prestadores_mayor_3000", "ARD y ARnD de los prestadores del servicio público de alcantarillado, con "
                                    "una carga mayor a 3.000,00 Kg/día DBO5"),
], {
    "ph": (PH69, PH69), "dqo": ("180,00", "150,00"), "dbo5": ("90,00", "70,00"), "sst": ("90,00", "70,00"),
    "solidos_sedimentables": ("5,00", "5,00"), "aceites_grasas": ("20,00", "10,00"),
    "compuestos_fenolicos": ("", AYR), "fenoles": ("", AYR), "saam": (AYR, AYR),
    "hidrocarburos_totales": (AYR, AYR), "hap": ("", AYR), "btex": ("", AYR), "aox": ("", AYR),
    "ortofosfatos": (AYR, AYR), "fosforo_total": (AYR, AYR), "nitratos": (AYR, AYR), "nitritos": (AYR, AYR),
    "nitrogeno_amoniacal": (AYR, AYR), "nitrogeno_total": (AYR, AYR), "cianuro": ("0,50", "0,50"),
    "cloruros": (AYR, AYR), "sulfatos": (AYR, AYR), "sulfuros": (AYR, AYR), "aluminio": (AYR, AYR),
    "cadmio": ("0,10", "0,10"), "zinc": ("3,00", "3,00"), "cobre": ("1,00", "1,00"), "cromo": ("0,50", "0,50"),
    "hierro": (AYR, AYR), "mercurio": ("0,02", "0,02"), "niquel": ("0,50", "0,50"), "plata": ("", AYR),
    "plomo": ("0,50", "0,50"), **_otros(2),
})

# ---------------------------------------------------------------- Articulo 9
_AGRO = "Actividades productivas de agroindustria y ganadería"
ACTIVIDADES += _tabla(9, _AGRO, [
    ("art9_hortalizas_frutas", "Procesamiento de hortalizas, frutas, legumbres, raíces y tubérculos"),
    ("art9_cafe_ecologico", "Beneficio de café – proceso ecológico"),
    ("art9_cafe_tradicional", "Beneficio de café – proceso tradicional"),
], {
    "ph": (PH69, "5,00 a 9,00", "5,00 a 9,00"), "dqo": ("150,00", "3.000,00", "650,00"),
    "dbo5": ("50,00", "", "400,00"), "sst": ("100,00", "800,00", "400,00"),
    "solidos_sedimentables": ("5,00", "10,00", "10,00"), "aceites_grasas": ("10,00", "30,00", "10,00"),
    "fosforo_total": (AYR,) * 3, "nitrogeno_total": (AYR,) * 3, "color": (AYR,) * 3,
})
ACTIVIDADES += _tabla(9, _AGRO, [
    ("art9_platano_banano", "Procesos postcosecha de plátano y banano"),
    ("art9_azucar", "Producción de azúcar y derivados a partir de caña de azúcar"),
    ("art9_aceites_vegetales", "Extracción de aceites de origen vegetal"),
], {
    "ph": (PH69,) * 3, "dqo": ("200,00", "900,00", "1.500,00"), "dbo5": ("50,00", "500,00", "600,00"),
    "sst": ("100,00", "200,00", "400,00"), "solidos_sedimentables": ("5,00", "2,00", "2,00"),
    "aceites_grasas": ("10,00", "20,00", "20,00"), "compuestos_fenolicos": (AYR,) * 3, "saam": (AYR,) * 3,
    "hidrocarburos_totales": ("", "10,00", "10,00"), "ortofosfatos": ("", AYR, AYR), "fosforo_total": (AYR,) * 3,
    "nitratos": ("", AYR, AYR), "nitritos": ("", AYR, AYR), "nitrogeno_amoniacal": ("", AYR, AYR),
    "nitrogeno_total": (AYR,) * 3, "cloruros": ("", "600,00", "500,00"), "sulfatos": ("", "500,00", "500,00"),
    "arsenico": ("", "0,50", "0,50"), "cadmio": ("", "0,05", "0,05"), "niquel": ("", "0,50", "0,50"),
    "plomo": ("", "0,20", "0,20"), **_otros(3),
})
ACTIVIDADES += _tabla(9, _AGRO, [
    ("art9_bovinos_cria", "Ganadería de bovino, bufalino, equino, ovino y/o caprino – cría"),
    ("art9_bovinos_beneficio", "Ganadería de bovino, bufalino, equino, ovino y/o caprino – beneficio"),
    ("art9_porcinos_cria", "Ganadería de porcinos – cría"),
    ("art9_porcinos_beneficio", "Ganadería de porcinos – beneficio"),
], {
    "ph": (PH69,) * 4, "dqo": ("500,00", "900,00", "900,00", "800,00"),
    "dbo5": ("250,00", "450,00", "450,00", "450,00"), "sst": ("150,00", "200,00", "400,00", "200,00"),
    "solidos_sedimentables": ("5,00",) * 4, "aceites_grasas": ("20,00", "50,00", "20,00", "30,00"),
    "saam": (AYR,) * 4, "ortofosfatos": (AYR,) * 4, "fosforo_total": (AYR,) * 4, "nitratos": (AYR,) * 4,
    "nitritos": (AYR,) * 4, "nitrogeno_amoniacal": (AYR,) * 4, "nitrogeno_total": (AYR,) * 4,
    "cloruros": ("", "500,00", "", "500,00"), "sulfatos": ("", "500,00", "", "500,00"), **_otros(4),
})
ACTIVIDADES += _tabla(9, _AGRO, [
    ("art9_beneficio_dual", "Ganadería de bovinos y porcinos – beneficio dual (bovinos y porcinos)"),
    ("art9_aves_cria", "Ganadería de aves de corral – incubación y cría"),
    ("art9_aves_beneficio", "Ganadería de aves de corral – beneficio"),
], {
    "ph": (PH69,) * 3, "dqo": ("800,00", "400,00", "650,00"), "dbo5": ("450,00", "200,00", "300,00"),
    "sst": ("225,00", "200,00", "100,00"), "solidos_sedimentables": ("5,00", "5,00", "2,00"),
    "aceites_grasas": ("30,00", "20,00", "40,00"), "saam": (AYR,) * 3, "ortofosfatos": (AYR, "", AYR),
    "fosforo_total": (AYR,) * 3, "nitratos": (AYR, "", AYR), "nitritos": (AYR, "", AYR),
    "nitrogeno_amoniacal": (AYR, "", AYR), "nitrogeno_total": (AYR,) * 3,
    "cloruros": ("600,00", "250,00", "250,00"), "sulfatos": ("500,00", "250,00", "250,00"), **_otros(3),
})

# --------------------------------------------------------------- Articulo 10
_MIN = "Actividades de minería"
ACTIVIDADES += _tabla(10, _MIN, [
    ("art10_carbon", "Extracción de carbón de piedra y lignito"),
    ("art10_hierro", "Extracción de minerales de hierro"),
    ("art10_oro", "Extracción de oro y otros metales preciosos"),
], {
    "ph": (PH69,) * 3, "dqo": ("150,00",) * 3, "dbo5": ("50,00",) * 3, "sst": ("50,00",) * 3,
    "solidos_sedimentables": ("2,00",) * 3, "aceites_grasas": ("10,00",) * 3, "fenoles": ("0,20",) * 3,
    "saam": (AYR,) * 3, "hidrocarburos_totales": ("10,00",) * 3, "hap": (AYR, "", ""), "btex": (AYR, "", ""),
    "aox": (AYR, "", ""), "ortofosfatos": (AYR,) * 3, "fosforo_total": (AYR,) * 3, "nitratos": (AYR,) * 3,
    "nitritos": (AYR,) * 3, "nitrogeno_amoniacal": (AYR,) * 3, "nitrogeno_total": (AYR,) * 3,
    "cianuro": ("1,00",) * 3, "cloruros": ("500,00", "250,00", "250,00"),
    "sulfatos": ("1.200,00", "250,00", "1.200,00"), "sulfuros": ("1,00",) * 3, "arsenico": ("0,10",) * 3,
    "cadmio": ("0,05",) * 3, "zinc": ("3,00",) * 3, "cobre": ("1,00",) * 3, "cromo": ("0,50",) * 3,
    "hierro": ("2,00",) * 3, "mercurio": ("0,002",) * 3, "niquel": ("0,50",) * 3, "plata": ("", "", "0,50"),
    "plomo": ("0,20",) * 3, **_otros(3),
})
ACTIVIDADES += _tabla(10, _MIN, [
    ("art10_niquel", "Extracción de minerales de níquel y otros minerales metalíferos no ferrosos"),
    ("art10_otras_minas", "Extracción de minerales de otras minas y canteras"),
], {
    "ph": (PH69,) * 2, "dqo": ("150,00",) * 2, "dbo5": ("50,00",) * 2, "sst": ("50,00",) * 2,
    "solidos_sedimentables": ("10,00", "2,00"), "aceites_grasas": ("10,00",) * 2, "fenoles": ("0,20",) * 2,
    "saam": (AYR,) * 2, "hidrocarburos_totales": ("10,00",) * 2, "hap": ("", AYR), "btex": ("", AYR),
    "ortofosfatos": (AYR,) * 2, "fosforo_total": (AYR,) * 2, "nitratos": (AYR,) * 2, "nitritos": (AYR,) * 2,
    "nitrogeno_amoniacal": (AYR,) * 2, "nitrogeno_total": (AYR,) * 2, "cianuro": ("1,00",) * 2,
    "cloruros": ("", "250,00"),
    # Niquel: 250,00 o 1.000,00 cuando realice el beneficio a traves de procesos de hidrometalurgia.
    "sulfatos": ("250,00", "400,00"), "sulfuros": ("", "1,00"), "aluminio": ("", AYR),
    "arsenico": ("0,10",) * 2, "cadmio": ("0,05",) * 2, "zinc": ("3,00",) * 2, "cobre": ("1,00",) * 2,
    "cromo": ("0,50",) * 2, "hierro": ("5,00", "2,00"), "manganeso": ("", AYR), "mercurio": ("0,002",) * 2,
    "molibdeno": ("", AYR), "niquel": ("0,50",) * 2, "plata": ("", "0,50"), "plomo": ("0,20",) * 2,
    **_otros(2),
})

# --------------------------------------------------------------- Articulo 11
ACTIVIDADES += _tabla(11, "Actividades de hidrocarburos (petróleo crudo, gas natural y derivados)", [
    ("art11_exploracion", "Hidrocarburos – exploración (upstream)"),
    ("art11_produccion", "Hidrocarburos – producción (upstream)"),
    ("art11_refino", "Hidrocarburos – refino"),
    ("art11_venta_distribucion", "Hidrocarburos – venta y distribución (downstream)"),
    ("art11_transporte", "Hidrocarburos – transporte y almacenamiento (midstream)"),
], {
    "ph": (PH69,) * 5, "dqo": ("400,00", "180,00", "400,00", "180,00", "180,00"),
    "dbo5": ("200,00", "60,00", "200,00", "60,00", "60,00"), "sst": ("50,00",) * 5,
    "solidos_sedimentables": ("1,00",) * 5, "aceites_grasas": ("15,00",) * 5, "fenoles": ("0,20",) * 5,
    "saam": (AYR,) * 5, "hidrocarburos_totales": ("10,00",) * 5, "hap": (AYR, AYR, AYR, AYR, ""),
    "btex": (AYR, AYR, AYR, AYR, ""), "aox": (AYR, AYR, AYR, "", ""), "fosforo_total": (AYR,) * 5,
    "ortofosfatos": (AYR, AYR, AYR, "", ""), "nitratos": (AYR, AYR, AYR, "", ""),
    "nitrogeno_amoniacal": (AYR, AYR, AYR, "", ""),
    # Refino: 10,00 o 40,00 si en el proceso de refino se incluyen actividades de hidrogenacion.
    "nitrogeno_total": ("10,00", "10,00", "10,00", AYR, AYR), "cianuro": ("1,00", "1,00", "1,00", "", ""),
    "cloruros": ("1.200,00", "1.200,00", "500,00", "250,00", "250,00"), "fluoruros": (AYR, AYR, AYR, "", ""),
    "sulfatos": ("300,00", "300,00", "500,00", "250,00", "250,00"), "sulfuros": ("1,00", "1,00", "1,00", "", ""),
    "arsenico": ("0,10", "0,10", "0,10", "", ""), "bario": (AYR, AYR, AYR, "", ""),
    "cadmio": ("0,10", "0,10", "0,10", "", ""), "zinc": ("3,00", "3,00", "3,00", "", ""),
    "cobre": ("1,00", "1,00", "1,00", "", ""), "cromo": ("0,50", "0,50", "0,50", "", ""),
    "hierro": ("3,00", "3,00", "3,00", "", ""), "mercurio": ("0,01", "0,01", "0,01", "", ""),
    "niquel": ("0,50", "0,50", "0,50", "", ""), "plata": (AYR, AYR, AYR, "", ""),
    "plomo": ("0,20", "0,20", "0,10", "", ""), "selenio": ("0,20", "0,20", "0,20", "", ""),
    "vanadio": ("1,00", "1,00", "1,00", "", ""), **_otros(5),
})

# --------------------------------------------------------------- Articulo 12
_ALI = "Actividades de elaboración de productos alimenticios y bebidas"
ACTIVIDADES += _tabla(12, _ALI, [
    ("art12_productos_alimenticios", "Elaboración de productos alimenticios"),
    ("art12_alimentos_animales", "Elaboración de alimentos preparados para animales"),
    ("art12_maltas_cervezas", "Elaboración de maltas y cervezas"),
    ("art12_bebidas_no_alcoholicas", "Elaboración de bebidas no alcohólicas, aguas minerales y otras aguas "
                                     "embotelladas"),
], {
    "ph": (PH69,) * 4, "dqo": ("600,00", "200,00", "200,00", "400,00"),
    "dbo5": ("400,00", "100,00", "100,00", "200,00"), "sst": ("200,00", "50,00", "50,00", "50,00"),
    "solidos_sedimentables": ("2,00", "1,00", "2,00", "2,00"), "aceites_grasas": ("20,00", "10,00", "10,00", "20,00"),
    "compuestos_fenolicos": (AYR, "", AYR, AYR), "saam": (AYR,) * 4, "ortofosfatos": (AYR,) * 4,
    "fosforo_total": (AYR,) * 4, "nitratos": (AYR,) * 4, "nitritos": (AYR, AYR, "", ""),
    "nitrogeno_amoniacal": (AYR,) * 4, "nitrogeno_total": (AYR,) * 4, "cianuro": ("0,50", "0,20", "", ""),
    "cloruros": ("250,00", "", "250,00", "600,00"), "sulfatos": ("250,00", "", "250,00", "500,00"),
    "cadmio": ("0,05", "0,05", "", ""), "zinc": ("3,00", "3,00", "", ""), "cobre": ("1,00", "1,00", "", ""),
    "cromo": ("0,50", "0,50", "", ""), "mercurio": ("0,01", "0,01", "", ""), "niquel": ("0,50", "", "", ""),
    "plomo": ("0,20", "0,20", "", ""), **_otros(4),
})
ACTIVIDADES += _tabla(12, _ALI, [
    ("art12_lacteos", "Elaboración de productos lácteos"),
    ("art12_aceites_grasas", "Elaboración de aceites y grasas de origen animal y vegetal"),
    ("art12_cafe_soluble", "Elaboración de café soluble"),
], {
    "ph": (PH69,) * 3, "dqo": ("450,00", "550,00", "1.000,00"), "dbo5": ("250,00", "300,00", "600,00"),
    "sst": ("150,00", "300,00", "400,00"), "solidos_sedimentables": ("2,00", "2,00", "5,00"),
    "aceites_grasas": ("20,00", "40,00", "30,00"), "compuestos_fenolicos": ("", AYR, AYR), "saam": (AYR,) * 3,
    "hidrocarburos_totales": ("", "10,00", ""), "ortofosfatos": (AYR, AYR, ""), "fosforo_total": (AYR,) * 3,
    "nitratos": (AYR, AYR, ""), "nitritos": (AYR, AYR, ""), "nitrogeno_amoniacal": (AYR, AYR, ""),
    "nitrogeno_total": (AYR,) * 3, "cloruros": ("500,00", "500,00", ""), "sulfatos": ("500,00", "250,00", ""),
    "cadmio": ("", "0,05", ""), "zinc": ("", "3,00", ""), "cobre": ("", "1,00", ""), "cromo": ("", "0,50", ""),
    "mercurio": ("", "0,01", ""), "niquel": ("", "0,50", ""), "plomo": ("", "0,20", ""), **_otros(3),
})

# --------------------------------------------------------------- Articulo 13
_MANU = "Actividades de fabricación y manufactura de bienes"
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_tabaco", "Fabricación de productos derivados del tabaco"),
    ("art13_textiles", "Fabricación de productos textiles"),
    ("art13_curtido", "Fabricación de artículos de piel, curtido y adobo de pieles"),
    ("art13_gases", "Fabricación de gases industriales y medicinales"),
], {
    "ph": (PH69,) * 4, "dqo": ("400,00", "400,00", "1.200,00", "300,00"),
    "dbo5": ("200,00", "200,00", "600,00", "200,00"), "sst": ("200,00", "50,00", "600,00", "50,00"),
    "solidos_sedimentables": ("2,00", "2,00", "2,00", "5,00"), "aceites_grasas": ("20,00", "20,00", "60,00", "10,00"),
    "fenoles": ("", "0,20", "", ""), "saam": ("", AYR, AYR, AYR), "hidrocarburos_totales": ("", "10,00", "10,00", ""),
    "hap": ("", AYR, AYR, ""), "btex": ("", AYR, AYR, ""), "aox": ("", AYR, AYR, ""),
    "ortofosfatos": (AYR, AYR, AYR, ""), "fosforo_total": (AYR,) * 4, "nitratos": (AYR, AYR, AYR, ""),
    "nitrogeno_amoniacal": (AYR, AYR, AYR, ""), "nitrogeno_total": (AYR,) * 4,
    "cloruros": ("", "1.200,00", "3.000,00", "250,00"), "sulfatos": ("", AYR, AYR, "500,00"),
    "sulfuros": ("", "1,00", "3,00", ""), "cadmio": ("", "0,02", "", "0,05"), "zinc": ("", "3,00", "", ""),
    "cobalto": ("", "0,50", "", ""), "cobre": ("", "1,00", "", ""), "cromo": ("", "0,50", "1,50", ""),
    "niquel": ("", "0,50", "", ""), **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_papel_pulpa", "Fabricación de papel y cartón – plantas integradas de pulpa blanqueada "
                          "(maderables y no maderables)"),
    ("art13_papel_reciclado", "Fabricación de papel y cartón a partir de fibras recicladas"),
    ("art13_abonos", "Fabricación de abonos y compuestos inorgánicos nitrogenados"),
], {
    "ph": (PH69,) * 3, "dqo": ("550,00", "800,00", "200,00"), "dbo5": ("300,00", "400,00", "100,00"),
    "sst": ("250,00", "400,00", "100,00"), "solidos_sedimentables": ("5,00", "5,00", "2,00"),
    "aceites_grasas": ("20,00", "40,00", "10,00"), "compuestos_fenolicos": (AYR, AYR, ""),
    "fenoles": ("0,20",) * 3, "saam": (AYR,) * 3, "hidrocarburos_totales": ("10,00",) * 3,
    "hap": (AYR, AYR, ""), "btex": (AYR, AYR, ""), "aox": (AYR, AYR, ""), "ortofosfatos": (AYR,) * 3,
    "fosforo_total": (AYR, AYR, "25,00"), "nitratos": (AYR,) * 3, "nitrogeno_amoniacal": (AYR,) * 3,
    "nitrogeno_total": (AYR, AYR, "700,00"), "cianuro": ("", "", "0,50"), "cloruros": ("1.200,00", "1.200,00", ""),
    "sulfatos": ("600,00", "600,00", "500,00"), "sulfuros": ("1,00",) * 3, "arsenico": ("", "", "0,10"),
    "bario": ("", "2,00", ""), "cadmio": ("", "0,05", "0,05"), "zinc": ("", "3,00", "3,00"),
    "cobre": ("", "1,00", "1,00"), "cromo": ("", "0,50", "0,50"), "mercurio": ("", "0,01", ""),
    "niquel": ("", "0,50", "0,50"), "titanio": (AYR, AYR, ""), **_otros(3),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_sustancias_quimicas", "Fabricación de sustancias y productos químicos"),
    ("art13_pigmentos_azul", "Fabricación de pigmentos inorgánicos – de azul ultramar"),
    ("art13_pigmentos_oxidos_hierro", "Fabricación de pigmentos inorgánicos – de óxidos de hierro"),
    ("art13_pigmentos_cromatos", "Fabricación de pigmentos inorgánicos – de cromatos y molibdatos de plomo"),
], {
    "ph": (PH69,) * 4, "dqo": ("800,00", "500,00", "500,00", "200,00"),
    "dbo5": ("600,00", "200,00", "200,00", "150,00"), "sst": ("200,00", "200,00", "200,00", "150,00"),
    "solidos_sedimentables": ("5,00",) * 4, "aceites_grasas": ("25,00",) * 4, "fenoles": ("0,20", "", "", ""),
    "formaldehido": (AYR, "", "", ""), "saam": (AYR, "", "", ""), "hidrocarburos_totales": ("10,00", "", "", ""),
    "fosforo_total": (AYR, "", "", ""), "nitratos": ("", "", "", AYR), "nitrogeno_amoniacal": ("", "", "", AYR),
    "nitrogeno_total": (AYR, "", "", AYR), "cianuro": ("0,50", "", "", ""), "cloruros": ("", AYR, AYR, AYR),
    "sulfatos": ("400,00", AYR, AYR, AYR), "sulfuros": ("1,00", "", "", ""), "arsenico": ("0,10", "", "", ""),
    "cadmio": ("0,05", "", "", ""), "zinc": ("3,00", "", "3,00", "3,00"), "cobalto": (AYR, "", "", ""),
    "cobre": ("1,00", "", "", ""), "cromo": ("0,50", "", "", "0,50"), "hierro": ("", "", "5,00", ""),
    "mercurio": ("0,01", "", "", ""), "niquel": ("0,50", "", "", ""), "plomo": ("0,20", "", "", "0,50"),
    "selenio": ("0,20", "", "", ""), **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_acidos_inorganicos", "Fabricación de ácidos inorgánicos y sus sales"),
    ("art13_plasticos", "Fabricación de plásticos en formas primarias, de formas básicas y artículos de plástico"),
    ("art13_sabores_fragancias", "Fabricación de sabores y fragancias"),
], {
    "ph": (PH69,) * 3, "dqo": ("180,00", "300,00", "600,00"), "dbo5": ("50,00", "125,00", "300,00"),
    "sst": ("50,00", "80,00", "70,00"), "solidos_sedimentables": ("1,00", "1,00", "2,00"),
    "aceites_grasas": ("10,00", "20,00", "10,00"), "fenoles": ("0,20",) * 3, "formaldehido": ("", "", AYR),
    "saam": (AYR,) * 3, "hidrocarburos_totales": ("10,00", "10,00", ""), "hap": ("", AYR, AYR),
    "btex": ("", AYR, ""), "cianuro": ("0,50", "1,00", ""), "cloruros": ("", "", "500,00"),
    "fluoruros": ("", "20,00", ""), "sulfatos": ("800,00", "", "500,00"), "sulfuros": ("1,00", "1,00", ""),
    "aluminio": ("", "3,00", ""), "arsenico": ("0,10", "0,10", ""), "cadmio": ("0,10", "0,10", ""),
    "zinc": ("3,00", "3,00", ""), "cobalto": (AYR, "", ""), "cobre": ("1,00", "1,00", ""),
    "cromo": ("0,50", "0,50", ""), "estano": ("", "2,00", ""), "hierro": ("", "3,00", ""),
    "mercurio": ("0,01", "0,01", ""), "niquel": ("0,50", "0,50", ""), "plata": ("", "0,20", ""),
    "plomo": ("0,20", "0,20", ""), "selenio": ("0,20", "", ""), **_otros(3),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_surfactantes", "Fabricación de surfactantes"),
    ("art13_plaguicidas", "Fabricación de plaguicidas y otros productos químicos de uso agropecuario"),
    ("art13_pinturas", "Fabricación de pinturas, barnices y revestimientos similares"),
    ("art13_jabones_cosmeticos", "Fabricación de jabones, detergentes y productos cosméticos"),
], {
    "ph": (PH69, PH69, PH69, "5,00 a 9,00"), "dqo": ("500,00", "600,00", "800,00", "500,00"),
    "dbo5": ("100,00", "200,00", "400,00", "250,00"), "sst": ("100,00", "200,00", "200,00", "80,00"),
    "solidos_sedimentables": ("5,00", "1,00", "2,00", "1,00"), "aceites_grasas": ("20,00", "10,00", "20,00", "15,00"),
    "fenoles": ("0,20",) * 4, "formaldehido": ("", "", AYR, ""), "saam": ("750,00", AYR, AYR, "10,00"),
    "hidrocarburos_totales": ("10,00", "", "10,00", "10,00"), "hap": ("", "", AYR, AYR),
    "btex": ("", "", AYR, AYR), "aox": ("", AYR, AYR, AYR), "ortofosfatos": (AYR, AYR, "", AYR),
    "fosforo_total": (AYR,) * 4, "nitratos": (AYR, AYR, "", AYR), "nitritos": ("", "", "", AYR),
    "nitrogeno_amoniacal": (AYR, AYR, "", AYR), "nitrogeno_total": (AYR,) * 4,
    "cloruros": ("250,00", AYR, "", "250,00"), "sulfatos": ("10.000,00", AYR, "", "400,00"),
    "sulfuros": ("1,0", "", "", "1,0"), "arsenico": ("", "0,10", "", "0,1"), "cadmio": ("", "", "0,05", "0,05"),
    "zinc": ("", "3,00", "3,00", "3,00"), "cobalto": ("", "", "0,10", ""), "cobre": ("", "1,00", "1,00", "1,00"),
    "cromo": ("", "0,50", "0,50", "0,50"), "mercurio": ("", "0,01", "0,01", "0,01"),
    "niquel": ("", "", "0,50", "0,50"), "plomo": ("", "", "0,20", "0,20"), "titanio": ("", "", AYR, ""),
    **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_farmaceuticos", "Fabricación de productos farmacéuticos, sustancias químicas medicinales y "
                            "productos botánicos de uso farmacéutico"),
    ("art13_vidrio_cemento", "Fabricación de vidrio, productos de vidrio, cemento, cal y yeso"),
    ("art13_ceramicos", "Fabricación de productos cerámicos"),
    ("art13_hormigon", "Fabricación de artículos de hormigón, cemento y yeso"),
], {
    "ph": (PH69,) * 4, "dqo": ("400,00", "130,00", "100,00", "200,00"),
    "dbo5": ("150,00", "50,00", "50,00", "100,00"), "sst": ("50,00", "50,00", "50,00", "100,00"),
    "solidos_sedimentables": ("1,00",) * 4, "aceites_grasas": ("15,00", "20,00", "10,00", "20,00"),
    "fenoles": ("0,20",) * 4, "saam": (AYR,) * 4, "cloruros": ("500,00", "250,00", "", ""),
    "fluoruros": ("", "5,00", "", ""), "sulfatos": ("500,00", "250,00", "", ""),
    "antimonio": ("", "0,30", "", ""), "arsenico": ("0,10", "0,10", "", ""), "cadmio": ("0,10",) * 4,
    "zinc": ("", "", "3,00", "3,00"), "cobre": ("", "", "1,00", ""), "cromo": ("", "", "0,10", ""),
    "mercurio": ("0,01", "", "", ""), "niquel": ("", "", "0,10", "0,10"), "plomo": ("", "0,10", "0,20", "0,10"),
    **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_tratamiento_metales", "Tratamiento y revestimiento de metales"),
    ("art13_pilas_baterias", "Fabricación de pilas, baterías y acumuladores eléctricos"),
    ("art13_equipos_iluminacion", "Fabricación de equipos eléctricos de iluminación"),
    ("art13_aparatos_domesticos", "Fabricación de aparatos de uso doméstico"),
], {
    "ph": (PH69,) * 4, "dqo": ("250,00", "100,00", "200,00", "160,00"),
    "dbo5": ("100,00", "50,00", "50,00", "80,00"), "sst": ("50,00",) * 4,
    "solidos_sedimentables": ("2,00", "1,00", "2,00", "2,00"), "aceites_grasas": ("10,00", "15,00", "10,00", "10,00"),
    "fenoles": ("0,20",) * 4, "saam": (AYR,) * 4, "hidrocarburos_totales": ("10,00",) * 4,
    "hap": (AYR, "", "", AYR), "btex": (AYR, "", "", AYR), "aox": ("", "", "", AYR),
    "fosforo_total": (AYR, "", AYR, AYR), "nitrogeno_total": ("", "", AYR, AYR),
    "cianuro": ("0,10", "0,10", "0,50", "0,50"), "fluoruros": ("", "", "5,0", ""), "sulfatos": ("", AYR, "", ""),
    "sulfuros": ("", "", "", "1,0"), "aluminio": ("3,00", "3,00", "", "3,00"), "antimonio": ("", "", "0,30", ""),
    "arsenico": ("0,10", "0,10", "0,50", "0,10"), "bario": ("1,00", "1,00", "", ""),
    "cadmio": ("0,05", "0,05", "0,05", "0,10"), "zinc": ("3,00",) * 4, "cobre": ("1,00",) * 4,
    "cromo": ("0,50",) * 4, "estano": ("2,00", "2,00", "", "2,00"), "hierro": ("3,00", "", "", ""),
    "mercurio": ("0,01", "0,01", "0,01", ""), "niquel": ("0,50",) * 4, "plata": ("0,20",) * 4,
    "plomo": ("0,20", "0,20", "", "0,20"), **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_maquinaria", "Fabricación de maquinaria y equipos (recubrimientos electrolíticos)"),
    ("art13_vehiculos", "Fabricación de vehículos automotores, remolques y semirremolques"),
    ("art13_autopartes", "Fabricación de autopartes"),
    ("art13_siderurgia", "Siderurgia"),
], {
    "ph": (PH69,) * 4, "dqo": ("200,00", "300,00", "400,00", "250,00"),
    "dbo5": ("100,00", "100,00", "200,00", "60,00"), "sst": ("50,00", "50,00", "100,00", "100,00"),
    "solidos_sedimentables": ("1,00", "2,00", "2,00", "5,00"), "aceites_grasas": ("10,00", "10,00", "30,00", "20,00"),
    "fenoles": ("0,20",) * 4, "saam": (AYR,) * 4, "hidrocarburos_totales": ("", "10,00", "10,00", "10,00"),
    "hap": ("", AYR, AYR, AYR), "btex": ("", AYR, AYR, AYR), "aox": ("", AYR, "", AYR),
    "fosforo_total": (AYR, AYR, "", AYR), "nitrogeno_total": (AYR,) * 4, "cianuro": ("0,50", "", "0,20", "0,50"),
    "fluoruros": ("", AYR, "", "5,00"), "sulfatos": ("", "", "", "500,00"), "sulfuros": ("", AYR, "", "1,00"),
    "aluminio": ("", "3,00", "3,00", "0,20"), "arsenico": ("", "0,10", "0,10", "0,05"),
    "cadmio": ("0,05", "0,10", "0,10", "0,01"), "zinc": ("3,00",) * 4, "cobre": ("1,00",) * 4,
    "cromo": ("0,50",) * 4, "estano": ("2,00",) * 4, "hierro": ("", "3,00", "3,00", "5,00"),
    "manganeso": ("", "", "", "2,00"), "mercurio": ("0,01",) * 4, "niquel": ("0,20", "0,50", "0,50", "0,50"),
    "plata": ("", "0,20", "0,20", ""), "plomo": ("0,20",) * 4, **_otros(4),
})
ACTIVIDADES += _tabla(13, _MANU, [
    ("art13_imprentas", "Imprentas y litografías"),
    ("art13_bebidas_destiladas", "Elaboración de bebidas alcohólicas destiladas"),
    ("art13_mezcla_bebidas", "Mezcla y formulación de bebidas alcohólicas"),
    ("art13_caucho", "Producción y fabricación de derivados del caucho"),
], {
    "ph": (PH69,) * 4, "dqo": ("200,00", "3.000,0", "500,00", "250,00"),
    "dbo5": ("100,00", "1.500,00", "200,00", "50,00"), "sst": ("50,00", "300,00", "200,00", "50,00"),
    "solidos_sedimentables": ("1,00", "2,00", "2,00", "2,00"), "aceites_grasas": ("10,00", "30,00", "20,00", "10,00"),
    "compuestos_fenolicos": ("", AYR, AYR, ""), "fenoles": ("0,20", "", "", ""), "saam": (AYR, AYR, AYR, ""),
    "hidrocarburos_totales": ("10,00", "", "", "10,00"), "hap": (AYR, "", "", AYR), "btex": (AYR, "", "", AYR),
    "aox": (AYR, "", "", AYR), "fosforo_total": ("", AYR, AYR, AYR), "nitrogeno_total": ("", AYR, AYR, AYR),
    "cianuro": ("0,20", "", "", ""), "sulfatos": ("", "", "", "250,00"), "sulfuros": ("", "", "", "1,00"),
    "aluminio": ("3,00", "", "", "3,00"), "arsenico": ("", "", "", "0,10"), "cadmio": ("0,10", "", "", "0,10"),
    "zinc": ("3,00", "", "", "3,00"), "cobre": ("1,00", "", "", "1,00"), "cromo": ("0,50", "", "", "0,50"),
    "estano": ("", "", "", "2,00"), "hierro": ("3,00", "", "", "3,00"), "mercurio": ("0,01", "", "", "0,01"),
    "niquel": ("", "", "", "0,50"), "plata": ("0,50", "", "", "0,20"), "plomo": ("0,50", "", "", "0,20"),
    **_otros(4),
})

# --------------------------------------------------------------- Articulo 14
_SERV = "Actividades asociadas con servicios y otras actividades"
ACTIVIDADES += _tabla(14, _SERV, [
    ("art14_energia_electrica", "Generación de energía eléctrica"),
    ("art14_residuos", "Tratamiento y disposición de residuos"),
    ("art14_reciclaje_plasticos", "Reciclaje de materiales plásticos y similares"),
    ("art14_reciclaje_tambores", "Reciclaje de tambores"),
], {
    "ph": (PH69,) * 4, "dqo": ("200,00", "2.000,00", "500,00", "1.000,00"),
    "dbo5": ("150,00", "800,00", "200,00", "600,00"), "sst": ("100,00", "400,00", "200,00", "150,00"),
    "solidos_sedimentables": ("5,00", "5,00", "1,00", "1,00"), "aceites_grasas": ("20,00", "50,00", "20,00", "20,00"),
    "compuestos_fenolicos": ("", AYR, "", ""), "fenoles": ("0,20",) * 4, "formaldehido": ("", "", AYR, ""),
    "saam": (AYR,) * 4, "hidrocarburos_totales": ("10,00",) * 4, "hap": ("", AYR, AYR, AYR),
    "btex": ("", AYR, AYR, AYR), "aox": ("", AYR, AYR, AYR), "fosforo_total": (AYR,) * 4,
    "ortofosfatos": ("", AYR, "", ""), "nitratos": ("", AYR, "", ""), "nitritos": ("", AYR, "", ""),
    "nitrogeno_amoniacal": ("", AYR, "", ""), "nitrogeno_total": (AYR,) * 4,
    "cianuro": ("", "0,50", "1,00", "1,00"), "cloruros": ("250,00", "500,00", "", AYR),
    "sulfatos": ("250,00", "600,00", "", AYR), "sulfuros": ("", AYR, "", ""), "aluminio": ("", "3,00", "", ""),
    "arsenico": ("0,50", "0,10", "", "0,10"), "bario": ("", "2,00", "", ""), "berilio": ("", AYR, "", ""),
    "boro": ("", AYR, "", ""), "cadmio": ("0,10", "0,05", "0,10", "0,10"), "zinc": ("3,00",) * 4,
    "cobalto": ("", AYR, "", ""), "cobre": ("1,00",) * 4, "cromo": ("0,50",) * 4,
    "estano": ("", AYR, "2,00", "2,00"), "hierro": ("1,00", "", "3,00", "3,00"), "litio": ("", AYR, "", ""),
    "manganeso": ("", AYR, "", ""), "mercurio": ("0,005", "0,01", "0,02", "0,02"),
    "molibdeno": ("", AYR, "", ""), "niquel": ("0,50",) * 4, "plata": ("", "", "0,20", "0,20"),
    "plomo": ("0,50", "0,20", "0,20", "0,20"), "selenio": ("", "0,20", "", ""), "vanadio": ("", "1,00", "", ""),
    **_otros(4),
})
ACTIVIDADES += _tabla(14, _SERV, [
    ("art14_salud_internacion", "Actividades de atención a la salud humana – atención médica con y sin internación"),
    ("art14_salud_dialisis", "Actividades de atención a la salud humana – hemodiálisis y diálisis peritoneal"),
    ("art14_pompas_funebres", "Pompas fúnebres y actividades relacionadas"),
], {
    "ph": (PH69,) * 3, "dqo": ("200,00", "800,00", "600,00"), "dbo5": ("150,00", "600,00", "250,00"),
    "sst": ("50,00", "100,00", "100,00"), "solidos_sedimentables": ("5,00", "1,00", "1,00"),
    "aceites_grasas": ("10,00", "10,00", "20,00"), "fenoles": ("0,20", "", "0,20"),
    "formaldehido": ("", "", AYR), "saam": (AYR, "", AYR), "ortofosfatos": (AYR, "", AYR),
    "fosforo_total": (AYR, "", AYR), "nitratos": (AYR, "", AYR), "nitritos": (AYR, "", ""),
    "nitrogeno_amoniacal": (AYR, "", AYR), "nitrogeno_total": (AYR,) * 3, "cianuro": ("0,50", "", ""),
    "cadmio": ("0,05", "", "0,05"), "cromo": ("0,50", "", "0,50"), "mercurio": ("0,01", "", "0,01"),
    "plata": (AYR, AYR, ""), "plomo": ("0,10", "", "0,10"), **_otros(3),
})

# --------------------------------------------------------------- Articulo 15
ACTIVIDADES += _tabla(15, "Actividades industriales, comerciales o de servicios diferentes a las contempladas "
                          "en los capítulos V y VI", [
    ("art15_otras", "Actividades industriales, comerciales o de servicios diferentes a las contempladas en los "
                    "capítulos V y VI"),
], {
    "ph": (PH69,), "dqo": ("150,00",), "dbo5": ("50,00",), "sst": ("50,00",), "solidos_sedimentables": ("1,00",),
    "aceites_grasas": ("10,00",), "compuestos_fenolicos": (AYR,), "fenoles": ("0,20",), "formaldehido": (AYR,),
    "saam": (AYR,), "hidrocarburos_totales": ("10,00",), "hap": (AYR,), "btex": (AYR,), "aox": (AYR,),
    "ortofosfatos": (AYR,), "fosforo_total": (AYR,), "nitratos": (AYR,), "nitritos": (AYR,),
    "nitrogeno_amoniacal": (AYR,), "nitrogeno_total": (AYR,), "cianuro": ("0,10",), "cloruros": ("250,00",),
    "fluoruros": ("5,0",), "sulfatos": ("250,0",), "sulfuros": ("1,00",), "aluminio": (AYR,),
    "antimonio": ("0,30",), "arsenico": ("0,10",), "bario": ("1,00",), "berilio": (AYR,), "boro": (AYR,),
    "cadmio": ("0,01",), "zinc": ("3,00",), "cobalto": ("0,10",), "cobre": ("1,00",), "cromo": ("0,10",),
    "estano": ("2,00",), "hierro": ("1,00",), "litio": (AYR,), "manganeso": (AYR,), "mercurio": ("0,002",),
    "molibdeno": (AYR,), "niquel": ("0,10",), "plata": ("0,20",), "plomo": ("0,10",), "selenio": ("0,20",),
    "titanio": (AYR,), "vanadio": ("1,00",), **_otros(1),
})

# Notas al pie de algunas celdas (valores alternativos).
NOTAS = {
    ("art10_niquel", "sulfatos"): "250,00 o 1.000,00 cuando realice el beneficio a través de procesos de "
                                 "hidrometalurgia.",
    ("art11_refino", "nitrogeno_total"): "10,00 o 40,00 si en el proceso de refino se incluyen actividades de "
                                         "hidrogenación.",
}

# Articulo 16 (alcantarillado publico): pH 5,00 a 9,00; estos parametros se multiplican por 1,50 y los demas
# aplican las mismas exigencias de la actividad especifica a cuerpos de agua superficiales.
PH_ALCANTARILLADO = "5,00 a 9,00"
FACTOR_ALCANTARILLADO = 1.5
MULTIPLICADOS_ALCANTARILLADO = frozenset({
    "dqo", "dbo5", "sst", "solidos_sedimentables", "aceites_grasas", "ortofosfatos", "fosforo_total",
    "nitratos", "nitritos", "nitrogeno_amoniacal", "nitrogeno_total",
})

# Parametros que lista el Articulo 16 (los demas -formaldehido, antimonio, berilio, litio, manganeso,
# molibdeno, titanio- no tienen limite para vertimientos al alcantarillado).
PARAMETROS_ALCANTARILLADO = frozenset({
    "ph", "dqo", "dbo5", "sst", "solidos_sedimentables", "aceites_grasas", "compuestos_fenolicos", "fenoles",
    "saam", "hidrocarburos_totales", "hap", "btex", "aox", "ortofosfatos", "fosforo_total", "nitratos", "nitritos",
    "nitrogeno_amoniacal", "nitrogeno_total", "cianuro", "cloruros", "fluoruros", "sulfatos", "sulfuros",
    "aluminio", "arsenico", "bario", "boro", "cadmio", "zinc", "cobalto", "cobre", "cromo", "estano", "hierro",
    "mercurio", "niquel", "plata", "plomo", "selenio", "vanadio", "acidez", "alcalinidad", "dureza_calcica",
    "dureza_total", "color",
})

# Articulo 5: temperatura maxima de 40,00 °C para todos los vertimientos (cuerpo de agua y alcantarillado).
TEMPERATURA_MAXIMA = 40.0

# Paragrafo (Arts. 8, 10, 11, 13, 14 y 15): si el receptor tiene uso para consumo humano y domestico, y pecuario,
# la concentracion de HAP debe ser <= 0,01 mg/L donde la actividad lo tiene como analisis y reporte.
HAP_CONSUMO_HUMANO = 0.01
