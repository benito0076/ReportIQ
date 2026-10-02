"""Textos descriptivos del informe de vertimientos (formato FP-023, informe EA-144-26).

Cada seccion del capitulo de analisis abre con un parrafo que describe el
parametro (fijo) y sigue con el parrafo de resultados, que se redacta con los
datos del proyecto (core/informe_vertimientos.py).
"""

# ------------------------------------------------------------ parametros in situ
INSITU = {
    "conductividad": (
        "La conductividad eléctrica es una medida de la capacidad de una muestra para movilizar electrones, es uno de "
        "los parámetros más importantes en la limnología, pues contribuye al mantenimiento de los procesos biológicos y "
        "mecanismos metabólicos de diferentes ecosistemas acuáticos; esta medida depende ampliamente de la composición "
        "iónica del cuerpo de agua, no solo de su concentración, sino también de su especie. La conductividad está "
        "íntimamente relacionada con la concentración de sólidos disueltos totales, o sustancias minerales: aguas con "
        "mayor concentración de sólidos disueltos totales tendrán una mayor conductividad, y esta relación también "
        "depende de la naturaleza de las sales presentes en el cuerpo de agua (Roldán & Ramírez, 2008)."
    ),
    "ph": (
        "Tanto para aguas naturales como para aguas residuales, el pH es un parámetro de suma importancia, puesto que "
        "determina las interacciones ecosistémicas de diferentes comunidades. Algunas especies son altamente sensibles "
        "a pequeñas variaciones del pH en el agua, pues podría alterar procesos biológicos básicos, que en caso de ser "
        "modificados desencadenarían resultados negativos dentro de un cuerpo de agua. Por otro lado, el pH es un "
        "parámetro importante en los procesos metabólicos de la célula, éste puede afectar el intercambio iónico en el "
        "interior de la célula y también en sus mecanismos de intercambio de nutrientes con el medio exterior."
    ),
    "sedimentables": (
        "En cuanto a los sólidos sedimentables, se puede afirmar que son aquellos que, por su tamaño y densidad, tienen "
        "la capacidad de depositarse por acción de la gravedad en estado de quietud."
    ),
    "temperatura": (
        "Las variaciones climáticas influyen considerablemente en el espesor de la capa de mezcla de las fuentes "
        "receptoras de aguas de vertimiento. Generalmente, se puede observar una capa constante, que en ocasiones puede "
        "ser alterada por cambios bruscos de temperatura en los que se modifica la densidad del agua en las capas "
        "superficiales del cuerpo de agua, produciendo como resultado la erosión de la termoclina y el consiguiente "
        "aumento de la zona de mezcla."
    ),
    "oxigeno": (
        "El oxígeno disuelto es indispensable para la vida acuática y para la degradación aerobia de la materia "
        "orgánica; su concentración depende de la temperatura, la presión y la carga orgánica del agua, por lo que es "
        "un indicador del estado del vertimiento y de la eficiencia de los sistemas de tratamiento."
    ),
}

# Rangos de pH (Tabla "Rangos de pH" del informe).
RANGOS_PH = [
    (None, 4.5, "<4,5", "Extremadamente ácido"),
    (4.5, 5.0, "4,5 – 5,0", "Muy fuertemente ácido"),
    (5.1, 5.5, "5,1 – 5,5", "Fuertemente ácido"),
    (5.6, 6.0, "5,6 – 6,0", "Medianamente ácido"),
    (6.1, 6.5, "6,1 – 6,5", "Ligeramente ácido"),
    (6.6, 7.3, "6,6 – 7,3", "Neutro"),
    (7.4, 7.8, "7,4 – 7,8", "Ligeramente básico"),
    (7.9, 8.4, "7,9 – 8,4", "Medianamente básico"),
    (8.5, 9.0, "8,5 – 9,0", "Básico"),
    (9.1, 10.0, "9,1 – 10,0", "Alcalino"),
    (10.0, None, ">10,0", "Fuertemente alcalino"),
]

# Clasificacion de la dureza total (mg CaCO3/L).
DUREZA = [(75, "blanda"), (150, "moderadamente dura"), (300, "dura"), (None, "muy dura")]
TABLA_DUREZA = [("Blandas", "0-75"), ("Moderadamente duras", "76-150"), ("Duras", "151-300"), ("Muy duras", ">300")]


def clase_ph(v: float) -> str:
    for _, hasta, _, nombre in RANGOS_PH:
        if hasta is None or v <= hasta + 0.049:
            return nombre.lower()
    return RANGOS_PH[-1][3].lower()


def clase_dureza(v: float) -> str:
    for hasta, nombre in DUREZA:
        if hasta is None or v <= hasta:
            return nombre
    return DUREZA[-1][1]


# ------------------------------------------------------ parametros de laboratorio
# (clave de seccion, titulo, parametros, descripcion). Los parametros que no figuran
# aqui van a una seccion propia con su nombre (sin descripcion).
SECCIONES = [
    ("aceites", "Aceites y grasas e hidrocarburos",
     ["aceites_grasas", "grasas_aceites", "hidrocarburos", "hidrocarburos_totales"],
     "Los aceites y grasas están constituidos por una alta variedad de compuestos, principalmente por ácidos grasos de "
     "origen animal y vegetal, así como hidrocarburos alifáticos, aromáticos y nafténicos, entre otros. Estos se "
     "encuentran en el agua en forma disuelta, como películas o emulsiones. Este parámetro puede producir un cambio en "
     "las características del agua, evitando que ingrese la luz y el oxígeno, por lo tanto, puede aumentar los niveles "
     "de anoxia en el cuerpo de agua."),
    ("acidez", "Acidez", ["acidez"],
     "La acidez del agua se define como la capacidad que toda agua tiene para neutralizar bases o la capacidad para "
     "reaccionar con iones hidróxido; la causa más común de la acidez en aguas es la presencia del CO2, el cual se puede "
     "encontrar disuelto como resultado de las reacciones de los coagulantes químicos usados en el tratamiento o de la "
     "oxidación de la materia orgánica."),
    ("alcalinidad", "Alcalinidad", ["alcalinidad"],
     "El valor de alcalinidad es utilizado en la interpretación y control del tratamiento de aguas claras y aguas "
     "tratadas. Expresa la capacidad que tiene un agua de reaccionar con ácidos fuertes, esta corresponde "
     "principalmente al contenido de carbonatos, bicarbonatos e hidróxidos. Además, los índices altos de alcalinidad "
     "pueden ser un indicador de corrosión en las redes de distribución."),
    ("cloruros", "Cloruros", ["cloruros"],
     "El ion cloruro se encuentra con frecuencia en las aguas naturales y residuales, en concentraciones que varían "
     "desde unas pocas ppm hasta varios gramos por litro. Este ion ingresa al agua en forma natural, mediante el lavado "
     "que las aguas lluvias realizan sobre el suelo."),
    ("color", "Color", ["color_436", "color_525", "color_620"],
     "Las causas más comunes del color del agua son la presencia de iones de hierro y de manganeso que se presenten de "
     "manera coloidal o en solución; el contacto del agua con desechos orgánicos como hojas, raíces o madera en "
     "diferentes estados de descomposición, o la presencia de taninos, ácido húmico o de diferentes residuos de tipo "
     "industrial. Los valores del color real se determinan a partir de medidas de absorbancia, tras filtrar "
     "previamente la muestra, a las longitudes de onda de 436 nm (amarillo), 525 nm (violeta) y 620 nm (verde-azul)."),
    ("dbo_dqo", "DBO5 y DQO", ["dbo5", "dqo"],
     "La DBO5 evalúa la cantidad de Oxígeno Disuelto (OD) en mg O2/L que será consumida por los organismos aeróbicos "
     "al degradar la materia orgánica. A través de la DBO5 se estima la carga orgánica en cuerpos de agua y en "
     "efluentes, y las necesidades de aireación para degradarla. Por su parte, la DQO evalúa la cantidad de oxígeno "
     "disuelto consumido en medio ácido para degradar la materia orgánica, biodegradable o no."),
    ("dureza", "Dureza Total y Dureza Cálcica", ["dureza_total", "dureza_calcica"],
     "La dureza del agua corresponde a la suma de los cationes metálicos con excepción de los cationes alcalinos. "
     "Fundamentalmente, la posible presencia de sales cálcicas, magnésicas, de hierro y de aluminio son las causantes "
     "de la dureza del agua; además, aguas con una baja dureza son consideradas blandas y biológicamente son poco "
     "productivas; por el contrario, las aguas duras presentan mayor producción de biomasa, aunque no se destaca una "
     "alta biodiversidad, mientras que aguas medianamente duras presentan fauna y flora más variada."),
    ("fenoles", "Fenoles", ["fenoles"],
     "Los fenoles son compuestos aromáticos que se caracterizan por tener uno o varios grupos hidroxilo unidos "
     "directamente al anillo aromático. La presencia de fenoles en el medio ambiente es consecuencia tanto de acciones "
     "naturales como del aporte antropogénico, fundamentalmente de carácter agrícola e industrial. Del total de los "
     "compuestos fenólicos, aproximadamente el 4 % son producidos naturalmente y el 96 % restante son de origen "
     "sintético."),
    ("fosforo", "Fósforo total y Ortofosfatos", ["fosforo_total", "ortofosfatos"],
     "En aguas residuales, el fósforo se presenta mayoritariamente en forma de fosfatos; estos son clasificados en "
     "ortofosfatos, fosfatos condensados (piro, meta y polifosfatos) y fosfatos enlazados orgánicamente. Este ion "
     "(PO4³⁻) se forma a partir del fósforo inorgánico que existe como mineral y contribuye directamente en el ciclo de "
     "este elemento en el ambiente. También puede existir en solución, como partículas, como fragmentos sueltos o en "
     "los cuerpos de organismos acuáticos. El fósforo en el agua es un indicador de la presencia de materia orgánica en "
     "el medio."),
    ("hap", "Hidrocarburos aromáticos policíclicos", [],
     "Los hidrocarburos aromáticos policíclicos (HAP) son un grupo de más de 100 sustancias químicas diferentes que se "
     "forman durante la combustión incompleta del carbón, petróleo y gasolina, basuras y otras sustancias orgánicas. "
     "Los HAP se encuentran generalmente como una mezcla de dos o más de estos compuestos, tal como el hollín, y están "
     "presentes en alquitrán, petróleo crudo, creosota y alquitrán para techado, aunque unos pocos se usan en "
     "medicamentos o para fabricar tinturas y pesticidas."),
    ("nitrogenados", "Compuestos nitrogenados", ["nitratos", "nitritos", "nitrogeno_amoniacal", "nitrogeno_total"],
     "Los nitritos y nitratos son compuestos solubles conformados molecularmente por nitrógeno y oxígeno. En el "
     "ambiente, el nitrito (NO2⁻) generalmente se convierte fácilmente en nitrato (NO3⁻). Si bien estos compuestos "
     "forman parte del ciclo natural del nitrógeno, las actividades humanas incrementan sus niveles principalmente en "
     "el suelo y, debido a su solubilidad en agua, llegan a alcanzar concentraciones importantes en ríos o lechos "
     "profundos. Una concentración elevada de compuestos nitrogenados en el agua refleja una carga orgánica "
     "significativa en el vertimiento."),
    ("sst", "Sólidos suspendidos totales", ["sst"],
     "Los sólidos suspendidos corresponden al material que se encuentra en fase sólida en el agua en forma de coloides "
     "o partículas sumamente finas, y que causa en el agua la turbidez. Cuanto mayor sea el contenido de sólidos en "
     "suspensión, mayor será el grado de turbidez."),
    ("sdt", "Sólidos disueltos totales", ["sdt"],
     "Los sólidos disueltos totales corresponden a las sales inorgánicas y a pequeñas cantidades de materia orgánica "
     "disueltas en el agua; están directamente relacionados con la conductividad eléctrica."),
    ("sulfatos", "Sulfatos", ["sulfatos"],
     "Una alta concentración de sulfatos en el agua tiene un efecto laxativo cuando se combina con calcio y magnesio, "
     "los dos componentes más comunes de la dureza del agua. En aguas residuales, la cantidad de sulfatos es un factor "
     "muy importante para la determinación de los problemas que puedan surgir por olor y corrosión de las "
     "alcantarillas. Además, está relacionada con la eficacia en el proceso de degradación, siendo los sulfatos "
     "aceptores de electrones en condiciones anaerobias."),
    ("sulfuros", "Sulfuros", ["sulfuros"],
     "Los sulfuros se forman en las aguas residuales por la reducción bacteriana de los sulfatos en condiciones "
     "anaerobias; generan olores desagradables (sulfuro de hidrógeno) y favorecen la corrosión de las redes de "
     "alcantarillado."),
    ("saam", "Surfactantes o Sustancias Activas al Azul de Metileno (SAAM)", ["saam"],
     "Este tipo de sustancias químicas presentan características tensoactivas o surfactantes; el mayor impacto de "
     "estos compuestos se genera luego de su vida útil (posconsumo), puesto que son ampliamente utilizados para "
     "actividades de limpieza doméstica e industrial. El mayor impacto generado por los tensoactivos es el aumento de "
     "fósforo, procedente del tripolifosfato, generando así un aumento de nutrientes en el agua, es decir, "
     "eutrofización. Por otro lado, la presencia de detergentes podría impedir la mezcla de oxígeno entre la atmósfera "
     "y el agua, afectando así a la hidrobiota."),
    ("metales", "Metales", [],
     "Como constituyentes importantes de muchas aguas podemos encontrar un número importante de metales pesados, "
     "aunque su cuantificación sea a niveles de traza (concentraciones bajas). Cualquier catión que tenga un peso "
     "atómico superior a 23 se considera un metal pesado; así que, tanto las aguas superficiales como residuales pueden "
     "contener gran número de diferentes metales pesados, dependiendo de las condiciones en las que se encuentren."),
    ("cianuro", "Cianuro total", ["cianuro"],
     "El cianuro cobija una variedad de compuestos químicos cuyos elementos fundamentales son el carbono y el "
     "nitrógeno, adquiriendo sus características de acuerdo con el elemento al que estén combinados. Respecto a los "
     "tipos de cianuro, se identifican dos compuestos principales: el cianuro de hidrógeno, un gas incoloro que se "
     "produce principalmente por la combinación de gas natural con amoniaco, y el cianuro de sodio, un compuesto "
     "sólido e incoloro que se combina fácilmente con el agua."),
    ("formaldehido", "Formaldehído", ["formaldehido"],
     "El formaldehído es un compuesto orgánico correspondiente a un gas incoloro, inflamable a temperatura ambiente. "
     "Tiene un olor penetrante característico y en niveles altos puede producir una sensación de ardor en los ojos, la "
     "nariz y los pulmones. Como producto químico altamente reactivo y de bajo costo, cuenta con numerosas "
     "aplicaciones, entre ellas los detergentes y agentes de limpieza industrial, donde se usa como desinfectante por "
     "sus propiedades insecticidas, germicidas y fungicidas."),
]

# Tecnica analitica y preservacion por parametro (Tabla de metodologia de preservacion).
_METALES = ("Espectrometría de masas", "HNO3 a pH<2 y refrigerar < 6°C")
_REFRIGERAR = "Refrigeración < 6°C"
TECNICA_PRESERVACION = {
    "aceites_grasas": ("Fotometría", "Acidificación con H2SO4 y refrigerar < 6°C"),
    "grasas_aceites": ("Fotometría", "Acidificación con H2SO4 y refrigerar < 6°C"),
    "hidrocarburos": ("Fotometría", "Acidificación con H2SO4 y refrigerar < 6°C"),
    "hidrocarburos_totales": ("Fotometría", "Acidificación con H2SO4 y refrigerar < 6°C"),
    "acidez": ("Volumetría", _REFRIGERAR),
    "alcalinidad": ("Volumetría", _REFRIGERAR),
    "cloruros": ("Volumetría", _REFRIGERAR),
    "color_436": ("Colorimétrico", _REFRIGERAR),
    "color_525": ("Colorimétrico", _REFRIGERAR),
    "color_620": ("Colorimétrico", _REFRIGERAR),
    "conductividad_max": ("Electrométrico", "N.A."),
    "conductividad_min": ("Electrométrico", "N.A."),
    "dbo5": ("Electrometría", _REFRIGERAR),
    "dqo": ("Fotometría", "H2SO4 a pH<2 y refrigerar < 6°C"),
    "dureza_calcica": ("Volumetría", "HNO3 a pH<2 y refrigerar < 6°C"),
    "dureza_total": ("Volumetría", "HNO3 a pH<2 y refrigerar < 6°C"),
    "fenoles": ("Fotometría", "H2SO4 a pH<2 y refrigerar < 6°C"),
    "ortofosfatos": ("Fotometría", _REFRIGERAR),
    "fosforo_total": ("Fotometría", "H2SO4 a pH<2 y refrigerar < 6°C"),
    "nitratos": ("Fotometría", _REFRIGERAR),
    "nitritos": ("Fotometría", _REFRIGERAR),
    "nitrogeno_amoniacal": ("Volumetría", "H2SO4 a pH<2 y refrigerar < 6°C"),
    "nitrogeno_total": ("Cálculo", "N.A."),
    "ph_max": ("Electrométrico", "N.A."),
    "ph_min": ("Electrométrico", "N.A."),
    "solidos_sedimentables_max": ("Volumétrico", "N.A."),
    "solidos_sedimentables_min": ("Volumétrico", "N.A."),
    "sst": ("Gravimetría", _REFRIGERAR),
    "sdt": ("Gravimetría", _REFRIGERAR),
    "sulfatos": ("Turbidimetría", _REFRIGERAR),
    "saam": ("Espectrofotometría", _REFRIGERAR),
    "temperatura_max": ("Electrométrico", "N.A."),
    "temperatura_min": ("Electrométrico", "N.A."),
    "cianuro": ("Electrometría", "NaOH a pH>12"),
    "formaldehido": ("Cromatografía", _REFRIGERAR),
}


def tecnica_preservacion(clave: str, grupo: str) -> tuple[str, str]:
    if clave in TECNICA_PRESERVACION:
        return TECNICA_PRESERVACION[clave]
    if grupo == "metal":
        return _METALES
    if grupo == "hap":
        return ("Cromatografía de gases", _REFRIGERAR)
    return ("N.E.", "N.E.")
