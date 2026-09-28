"""Interfaz grafica (Tkinter) de la aplicacion de procesamiento de ruido
ambiental: define el proyecto, asigna las memorias del sonometro, procesa
todo con la metodologia de la Res. 0627 y genera Excel / graficas / Word."""
from __future__ import annotations

import os
import sys
import traceback
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import norms
from core.charts import generar_graficas
from core.excel_export import exportar_resultados
from core.models import ArchivoMemoria, DIRECCIONES, ESQUEMAS, ESQUEMA_LABELS, Proyecto
from core.pipeline import procesar_proyecto
from core.project_io import cargar_proyecto, guardar_proyecto
from core.report_generator import ErrorPlantilla, generar_informe
from core.isophones import SinCoordenadasError, generar_mapa_isofonas_esquema
from core.equipos import cargar_equipos, guardar_equipos

# Cuando la app corre empaquetada con PyInstaller (--onefile), los recursos
# agregados con --add-data (p.ej. la plantilla) quedan bajo sys._MEIPASS, una
# carpeta TEMPORAL que se borra al cerrar la app -por eso no sirve para nada
# que el usuario deba poder editar y conservar, como el inventario de
# equipos-. Para eso se usa la carpeta donde esta el .exe real (persiste
# entre ejecuciones).
if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
    CONFIG_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CONFIG_DIR = BASE_DIR
PLANTILLA_DEFECTO = os.path.join(BASE_DIR, "templates", "informe_template.docx")
RUTA_EQUIPOS = os.path.join(CONFIG_DIR, "equipos.json")


class PuntoDialog(tk.Toplevel):
    """Dialogo para crear/editar un punto de monitoreo."""

    def __init__(self, master, punto=None):
        super().__init__(master)
        self.title("Punto de monitoreo")
        self.resizable(False, False)
        self.resultado = None
        self.grab_set()

        frm = ttk.Frame(self, padding=12)
        frm.grid(sticky="nsew")

        ttk.Label(frm, text="Nombre del punto:").grid(row=0, column=0, sticky="w", pady=4)
        self.var_nombre = tk.StringVar(value=punto.nombre if punto else "")
        ttk.Entry(frm, textvariable=self.var_nombre, width=30).grid(row=0, column=1, pady=4)

        ttk.Label(frm, text="Sector (Res. 0627):").grid(row=1, column=0, sticky="w", pady=4)
        self.var_sector = tk.StringVar(value=punto.sector if punto else "")
        combo = ttk.Combobox(frm, textvariable=self.var_sector, values=norms.opciones_sector(), width=55, state="readonly")
        combo.grid(row=1, column=1, pady=4, sticky="w")

        ttk.Label(frm, text="Incertidumbre de la tecnica (+/- dB):").grid(row=2, column=0, sticky="w", pady=4)
        self.var_incert = tk.StringVar(value=str(punto.incertidumbre) if punto else "0.0043")
        ttk.Entry(frm, textvariable=self.var_incert, width=15).grid(row=2, column=1, pady=4, sticky="w")

        ttk.Label(frm, text="Coordenada Este / Longitud:").grid(row=3, column=0, sticky="w", pady=4)
        self.var_lon = tk.StringVar(value=punto.longitud if punto else "")
        ttk.Entry(frm, textvariable=self.var_lon, width=20).grid(row=3, column=1, pady=4, sticky="w")

        ttk.Label(frm, text="Coordenada Norte / Latitud:").grid(row=4, column=0, sticky="w", pady=4)
        self.var_lat = tk.StringVar(value=punto.latitud if punto else "")
        ttk.Entry(frm, textvariable=self.var_lat, width=20).grid(row=4, column=1, pady=4, sticky="w")

        ttk.Label(
            frm, text="(Coordenadas Origen Nacional en metros -recomendado para Colombia,\n"
                      "se convierten automaticamente a Longitud/Latitud en el informe- o ya\n"
                      "en grados decimales. Con menos de 3 puntos con coordenadas no se\n"
                      "puede generar el mapa de isofonas.)",
            foreground="#555555", justify="left",
        ).grid(row=5, column=0, columnspan=2, sticky="w", pady=(0, 4))

        ttk.Label(frm, text="Altitud (m.s.n.m., opcional):").grid(row=6, column=0, sticky="w", pady=4)
        self.var_altitud = tk.StringVar(value=punto.altitud if punto else "")
        ttk.Entry(frm, textvariable=self.var_altitud, width=15).grid(row=6, column=1, pady=4, sticky="w")

        ttk.Label(frm, text="Foto del punto:").grid(row=7, column=0, sticky="w", pady=4)
        foto_frame = ttk.Frame(frm)
        foto_frame.grid(row=7, column=1, pady=4, sticky="w")
        self.var_foto = tk.StringVar(value=punto.foto_ruta if punto else "")
        self._lbl_foto = ttk.Label(
            foto_frame, text=os.path.basename(self.var_foto.get()) or "(sin foto)", foreground="#555555"
        )
        self._lbl_foto.pack(side="left", padx=(0, 6))
        ttk.Button(foto_frame, text="Cargar foto...", command=self._elegir_foto).pack(side="left")

        ttk.Label(frm, text="Descripcion del punto:").grid(row=8, column=0, sticky="nw", pady=4)
        self.txt_descripcion = tk.Text(frm, width=60, height=8, wrap="word")
        self.txt_descripcion.grid(row=8, column=1, pady=4, sticky="w")
        if punto and punto.descripcion:
            self.txt_descripcion.insert("1.0", punto.descripcion)

        botones = ttk.Frame(frm)
        botones.grid(row=9, column=0, columnspan=2, pady=(12, 0))
        ttk.Button(botones, text="Guardar", command=self._guardar).pack(side="left", padx=4)
        ttk.Button(botones, text="Cancelar", command=self.destroy).pack(side="left", padx=4)

    def _elegir_foto(self):
        ruta = filedialog.askopenfilename(
            title="Foto del punto",
            filetypes=[("Imagenes", "*.jpg *.jpeg *.png *.bmp"), ("Todos los archivos", "*.*")],
            parent=self,
        )
        if ruta:
            self.var_foto.set(ruta)
            self._lbl_foto.config(text=os.path.basename(ruta))

    def _guardar(self):
        nombre = self.var_nombre.get().strip()
        if not nombre:
            messagebox.showerror("Falta informacion", "El punto debe tener un nombre.", parent=self)
            return
        try:
            incert = float(self.var_incert.get().replace(",", "."))
        except ValueError:
            messagebox.showerror("Valor invalido", "La incertidumbre debe ser un numero.", parent=self)
            return
        self.resultado = {
            "nombre": nombre, "sector": self.var_sector.get(),
            "incertidumbre": incert, "longitud": self.var_lon.get(), "latitud": self.var_lat.get(),
            "altitud": self.var_altitud.get().strip(), "foto_ruta": self.var_foto.get(),
            "descripcion": self.txt_descripcion.get("1.0", "end").rstrip("\n"),
        }
        self.destroy()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Procesamiento de Ruido Ambiental - Res. 0627")
        self.geometry("980x680")

        self.proyecto = Proyecto()
        self.resultados = None
        self.ruta_proyecto = None
        self.rutas_graficas = {}
        self.rutas_isofonas = {}

        self._crear_menu()

        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=8, pady=8)

        self.tab_proyecto = ttk.Frame(self.notebook)
        self.tab_archivos = ttk.Frame(self.notebook)
        self.tab_procesar = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_proyecto, text="1. Proyecto y puntos")
        self.notebook.add(self.tab_archivos, text="2. Memorias del sonometro")
        self.notebook.add(self.tab_procesar, text="3. Procesar y generar informe")

        self._construir_tab_proyecto()
        self._construir_tab_archivos()
        self._construir_tab_procesar()

    # ------------------------------------------------------------------ menu
    def _crear_menu(self):
        menubar = tk.Menu(self)
        archivo = tk.Menu(menubar, tearoff=0)
        archivo.add_command(label="Nuevo proyecto", command=self._nuevo_proyecto)
        archivo.add_command(label="Abrir proyecto...", command=self._abrir_proyecto)
        archivo.add_command(label="Guardar proyecto...", command=self._guardar_proyecto)
        archivo.add_separator()
        archivo.add_command(label="Salir", command=self.destroy)
        menubar.add_cascade(label="Archivo", menu=archivo)

        equipos_menu = tk.Menu(menubar, tearoff=0)
        equipos_menu.add_command(label="Editar inventario de equipos...", command=self._editar_equipos)
        menubar.add_cascade(label="Equipos", menu=equipos_menu)

        self.config(menu=menubar)

    def _editar_equipos(self):
        if not os.path.exists(RUTA_EQUIPOS):
            try:
                guardar_equipos(cargar_equipos(None), RUTA_EQUIPOS)
            except Exception as exc:  # noqa: BLE001
                messagebox.showerror("Error", f"No se pudo crear el archivo de equipos:\n{exc}")
                return
        try:
            os.startfile(RUTA_EQUIPOS)
        except Exception:  # noqa: BLE001
            messagebox.showinfo(
                "Inventario de equipos",
                f"Edite el archivo con un editor de texto (p.ej. Bloc de notas):\n{RUTA_EQUIPOS}",
            )

    def _nuevo_proyecto(self):
        if not messagebox.askyesno("Nuevo proyecto", "Se perdera el proyecto actual si no lo has guardado. ¿Continuar?"):
            return
        self.proyecto = Proyecto()
        self.resultados = None
        self.ruta_proyecto = None
        self._refrescar_puntos()
        self._refrescar_combo_puntos()

    def _abrir_proyecto(self):
        ruta = filedialog.askopenfilename(title="Abrir proyecto", filetypes=[("Proyecto de ruido (.json)", "*.json")])
        if not ruta:
            return
        try:
            self.proyecto = cargar_proyecto(ruta)
            self.ruta_proyecto = ruta
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Error al abrir", str(exc))
            return
        self.var_nombre_proyecto.set(self.proyecto.nombre_proyecto)
        self.var_cliente.set(self.proyecto.cliente)
        self.var_codigo.set(self.proyecto.codigo_informe)
        self._refrescar_puntos()
        self._refrescar_combo_puntos()
        messagebox.showinfo("Proyecto cargado", f"Proyecto cargado desde:\n{ruta}")

    def _guardar_proyecto(self):
        self._sincronizar_datos_proyecto()
        ruta = self.ruta_proyecto or filedialog.asksaveasfilename(
            title="Guardar proyecto", defaultextension=".json", filetypes=[("Proyecto de ruido (.json)", "*.json")]
        )
        if not ruta:
            return
        try:
            guardar_proyecto(self.proyecto, ruta)
            self.ruta_proyecto = ruta
            messagebox.showinfo("Guardado", f"Proyecto guardado en:\n{ruta}")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror("Error al guardar", str(exc))

    def _sincronizar_datos_proyecto(self):
        self.proyecto.nombre_proyecto = self.var_nombre_proyecto.get()
        self.proyecto.cliente = self.var_cliente.get()
        self.proyecto.codigo_informe = self.var_codigo.get()

    # ------------------------------------------------------------ tab 1: proyecto
    def _construir_tab_proyecto(self):
        frm = ttk.Frame(self.tab_proyecto, padding=10)
        frm.pack(fill="both", expand=True)

        datos = ttk.LabelFrame(frm, text="Datos generales del proyecto", padding=10)
        datos.pack(fill="x", pady=(0, 10))

        self.var_nombre_proyecto = tk.StringVar()
        self.var_cliente = tk.StringVar()
        self.var_codigo = tk.StringVar()

        ttk.Label(datos, text="Nombre del proyecto:").grid(row=0, column=0, sticky="w")
        ttk.Entry(datos, textvariable=self.var_nombre_proyecto, width=40).grid(row=0, column=1, sticky="w", padx=6)
        ttk.Label(datos, text="Cliente:").grid(row=0, column=2, sticky="w", padx=(20, 0))
        ttk.Entry(datos, textvariable=self.var_cliente, width=30).grid(row=0, column=3, sticky="w", padx=6)
        ttk.Label(datos, text="Codigo de informe:").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(datos, textvariable=self.var_codigo, width=25).grid(row=1, column=1, sticky="w", padx=6, pady=(6, 0))

        puntos_frame = ttk.LabelFrame(frm, text="Puntos de monitoreo", padding=10)
        puntos_frame.pack(fill="both", expand=True)

        columnas = ("no", "nombre", "sector", "incert")
        self.tree_puntos = ttk.Treeview(puntos_frame, columns=columnas, show="headings", height=10)
        self.tree_puntos.heading("no", text="No.")
        self.tree_puntos.heading("nombre", text="Nombre")
        self.tree_puntos.heading("sector", text="Sector (Res. 0627)")
        self.tree_puntos.heading("incert", text="Incertidumbre")
        self.tree_puntos.column("no", width=40, anchor="center")
        self.tree_puntos.column("nombre", width=120)
        self.tree_puntos.column("sector", width=560)
        self.tree_puntos.column("incert", width=90, anchor="center")
        self.tree_puntos.pack(fill="both", expand=True, side="left")

        scroll = ttk.Scrollbar(puntos_frame, orient="vertical", command=self.tree_puntos.yview)
        self.tree_puntos.configure(yscrollcommand=scroll.set)
        scroll.pack(side="left", fill="y")

        botones = ttk.Frame(frm)
        botones.pack(fill="x", pady=8)
        ttk.Button(botones, text="Agregar punto", command=self._agregar_punto).pack(side="left", padx=4)
        ttk.Button(botones, text="Editar punto", command=self._editar_punto).pack(side="left", padx=4)
        ttk.Button(botones, text="Eliminar punto", command=self._eliminar_punto).pack(side="left", padx=4)

    def _refrescar_puntos(self):
        for item in self.tree_puntos.get_children():
            self.tree_puntos.delete(item)
        for p in self.proyecto.puntos:
            self.tree_puntos.insert("", "end", iid=str(p.no_punto),
                                     values=(p.no_punto, p.nombre, p.sector, p.incertidumbre))

    def _agregar_punto(self):
        dlg = PuntoDialog(self)
        self.wait_window(dlg)
        if dlg.resultado:
            p = self.proyecto.agregar_punto(dlg.resultado["nombre"], dlg.resultado["sector"])
            p.incertidumbre = dlg.resultado["incertidumbre"]
            p.longitud = dlg.resultado["longitud"]
            p.latitud = dlg.resultado["latitud"]
            p.altitud = dlg.resultado["altitud"]
            p.foto_ruta = dlg.resultado["foto_ruta"]
            p.descripcion = dlg.resultado["descripcion"]
            self._refrescar_puntos()
            self._refrescar_combo_puntos()

    def _punto_seleccionado(self):
        sel = self.tree_puntos.selection()
        if not sel:
            return None
        no_punto = int(sel[0])
        return next((p for p in self.proyecto.puntos if p.no_punto == no_punto), None)

    def _editar_punto(self):
        punto = self._punto_seleccionado()
        if not punto:
            messagebox.showinfo("Seleccione un punto", "Seleccione un punto de la lista para editarlo.")
            return
        dlg = PuntoDialog(self, punto)
        self.wait_window(dlg)
        if dlg.resultado:
            punto.nombre = dlg.resultado["nombre"]
            punto.sector = dlg.resultado["sector"]
            punto.incertidumbre = dlg.resultado["incertidumbre"]
            punto.longitud = dlg.resultado["longitud"]
            punto.latitud = dlg.resultado["latitud"]
            punto.altitud = dlg.resultado["altitud"]
            punto.foto_ruta = dlg.resultado["foto_ruta"]
            punto.descripcion = dlg.resultado["descripcion"]
            self._refrescar_puntos()
            self._refrescar_combo_puntos()

    def _eliminar_punto(self):
        punto = self._punto_seleccionado()
        if not punto:
            messagebox.showinfo("Seleccione un punto", "Seleccione un punto de la lista para eliminarlo.")
            return
        if messagebox.askyesno("Eliminar punto", f"¿Eliminar el punto '{punto.nombre}'?"):
            self.proyecto.puntos.remove(punto)
            self._refrescar_puntos()
            self._refrescar_combo_puntos()

    # ---------------------------------------------------------- tab 2: archivos
    def _construir_tab_archivos(self):
        frm = ttk.Frame(self.tab_archivos, padding=10)
        frm.pack(fill="both", expand=True)

        selector = ttk.Frame(frm)
        selector.pack(fill="x", pady=(0, 10))

        ttk.Label(selector, text="Punto de monitoreo:").grid(row=0, column=0, sticky="w")
        self.var_punto_sel = tk.StringVar()
        self.combo_puntos = ttk.Combobox(selector, textvariable=self.var_punto_sel, state="readonly", width=30)
        self.combo_puntos.grid(row=0, column=1, padx=6)
        self.combo_puntos.bind("<<ComboboxSelected>>", lambda e: self._refrescar_archivos())

        ttk.Label(selector, text="Jornada / tipo de dia:").grid(row=0, column=2, sticky="w", padx=(20, 0))
        self.var_esquema_sel = tk.StringVar(value=ESQUEMAS[0])
        combo_esquema = ttk.Combobox(
            selector, textvariable=self.var_esquema_sel, state="readonly", width=28,
            values=[ESQUEMA_LABELS[e] for e in ESQUEMAS],
        )
        combo_esquema.current(0)
        combo_esquema.grid(row=0, column=3, padx=6)
        combo_esquema.bind("<<ComboboxSelected>>", lambda e: self._refrescar_archivos())

        self.frame_direcciones = ttk.LabelFrame(frm, text="Archivos de memoria por direccion del microfono", padding=10)
        self.frame_direcciones.pack(fill="both", expand=True)

        self.vars_archivo = {}
        for i, direccion in enumerate(DIRECCIONES):
            ttk.Label(self.frame_direcciones, text=f"{direccion}:", width=12).grid(row=i, column=0, sticky="w", pady=4)
            var = tk.StringVar()
            self.vars_archivo[direccion] = var
            ttk.Entry(self.frame_direcciones, textvariable=var, width=75, state="readonly").grid(row=i, column=1, padx=6)
            ttk.Button(self.frame_direcciones, text="Examinar...",
                       command=lambda d=direccion: self._elegir_archivo(d)).grid(row=i, column=2, padx=4)
            ttk.Button(self.frame_direcciones, text="Quitar",
                       command=lambda d=direccion: self._quitar_archivo(d)).grid(row=i, column=3, padx=4)

        ttk.Label(
            frm,
            text="Sugerencia: exporta cada punto/direccion desde el software del sonometro como .xlsx\n"
                 "(hojas 'Resumen' y 'OBA') y asignalos aqui para cada jornada medida.",
            foreground="#555555",
        ).pack(anchor="w", pady=(8, 0))

    def _refrescar_combo_puntos(self):
        nombres = [p.nombre for p in self.proyecto.puntos]
        self.combo_puntos["values"] = nombres
        if nombres and not self.var_punto_sel.get():
            self.combo_puntos.current(0)
        self._refrescar_archivos()

    def _punto_por_nombre(self, nombre):
        return next((p for p in self.proyecto.puntos if p.nombre == nombre), None)

    def _esquema_actual(self):
        etiqueta = self.var_esquema_sel.get()
        for esquema, label in ESQUEMA_LABELS.items():
            if label == etiqueta:
                return esquema
        return ESQUEMAS[0]

    def _refrescar_archivos(self):
        punto = self._punto_por_nombre(self.var_punto_sel.get())
        esquema = self._esquema_actual()
        for direccion in DIRECCIONES:
            if punto:
                ruta = punto.archivos[esquema][direccion].ruta or ""
                self.vars_archivo[direccion].set(os.path.basename(ruta) if ruta else "")
            else:
                self.vars_archivo[direccion].set("")

    def _elegir_archivo(self, direccion):
        punto = self._punto_por_nombre(self.var_punto_sel.get())
        if not punto:
            messagebox.showinfo("Seleccione un punto", "Primero seleccione o cree un punto de monitoreo.")
            return
        ruta = filedialog.askopenfilename(
            title=f"Memoria del sonometro - {direccion}",
            filetypes=[("Excel", "*.xlsx"), ("Todos los archivos", "*.*")],
        )
        if not ruta:
            return
        esquema = self._esquema_actual()
        punto.archivos[esquema][direccion] = ArchivoMemoria(direccion, ruta)
        self._refrescar_archivos()

    def _quitar_archivo(self, direccion):
        punto = self._punto_por_nombre(self.var_punto_sel.get())
        if not punto:
            return
        esquema = self._esquema_actual()
        punto.archivos[esquema][direccion] = ArchivoMemoria(direccion, None)
        self._refrescar_archivos()

    # --------------------------------------------------------- tab 3: procesar
    def _construir_tab_procesar(self):
        frm = ttk.Frame(self.tab_procesar, padding=10)
        frm.pack(fill="both", expand=True)

        botones = ttk.Frame(frm)
        botones.pack(fill="x", pady=(0, 10))
        ttk.Button(botones, text="1) Procesar proyecto", command=self._procesar).pack(side="left", padx=4)
        ttk.Button(botones, text="2) Exportar Excel...", command=self._exportar_excel).pack(side="left", padx=4)
        ttk.Button(botones, text="3) Generar graficas...", command=self._generar_graficas).pack(side="left", padx=4)
        ttk.Button(botones, text="4) Generar mapas de isofonas...", command=self._generar_isofonas).pack(side="left", padx=4)
        ttk.Button(botones, text="5) Generar informe Word...", command=self._generar_word).pack(side="left", padx=4)

        resultados_frame = ttk.LabelFrame(frm, text="Comparacion con la Resolucion 0627", padding=10)
        resultados_frame.pack(fill="both", expand=True)

        columnas = ("punto", "dh", "dnh", "std_dia", "ndh", "ndnh", "std_noche")
        self.tree_resultados = ttk.Treeview(resultados_frame, columns=columnas, show="headings", height=10)
        titulos = {
            "punto": "Punto", "dh": "LRAeq Diurno Habil", "dnh": "LRAeq Diurno No Habil",
            "std_dia": "Estandar diurno", "ndh": "LRAeq Nocturno Habil",
            "ndnh": "LRAeq Nocturno No Habil", "std_noche": "Estandar nocturno",
        }
        for c in columnas:
            self.tree_resultados.heading(c, text=titulos[c])
            self.tree_resultados.column(c, width=125, anchor="center")
        self.tree_resultados.pack(fill="both", expand=True)

        self.txt_log = tk.Text(frm, height=8, wrap="word")
        self.txt_log.pack(fill="both", expand=False, pady=(10, 0))

    def _log(self, mensaje):
        self.txt_log.insert("end", mensaje + "\n")
        self.txt_log.see("end")

    def _procesar(self):
        self._sincronizar_datos_proyecto()
        if not self.proyecto.puntos:
            messagebox.showinfo("Sin puntos", "Agregue al menos un punto de monitoreo en la pestaña 1.")
            return
        try:
            self.resultados = procesar_proyecto(self.proyecto)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            messagebox.showerror("Error al procesar", str(exc))
            return

        for item in self.tree_resultados.get_children():
            self.tree_resultados.delete(item)
        for no_punto, rc in self.resultados.comparacion.items():
            def f(v):
                return "" if v is None else f"{v:.1f}"
            self.tree_resultados.insert("", "end", values=(
                rc.punto.nombre, f(rc.lraeq_dh), f(rc.lraeq_dnh), f(rc.estandar_diurno),
                f(rc.lraeq_ndh), f(rc.lraeq_ndnh), f(rc.estandar_nocturno),
            ))

        self.txt_log.delete("1.0", "end")
        self._log(f"Procesamiento completado: {len(self.proyecto.puntos)} punto(s).")
        for adv in self.resultados.advertencias:
            self._log(f"ADVERTENCIA [{adv.punto} / {adv.esquema}]: {adv.mensaje}")
        if not self.resultados.advertencias:
            self._log("Sin advertencias.")

    def _exportar_excel(self):
        if not self._verificar_procesado():
            return
        ruta = filedialog.asksaveasfilename(
            title="Exportar resultados a Excel", defaultextension=".xlsx",
            filetypes=[("Libro de Excel", "*.xlsx")],
        )
        if not ruta:
            return
        try:
            exportar_resultados(self.resultados, ruta)
            self._log(f"Excel exportado a: {ruta}")
            messagebox.showinfo("Listo", f"Resultados exportados a:\n{ruta}")
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            messagebox.showerror("Error al exportar", str(exc))

    def _generar_graficas(self):
        if not self._verificar_procesado():
            return
        carpeta = filedialog.askdirectory(title="Carpeta donde guardar las graficas")
        if not carpeta:
            return
        try:
            self.rutas_graficas = generar_graficas(self.resultados, carpeta)
            self._log(f"Graficas generadas en: {carpeta}")
            messagebox.showinfo("Listo", f"Graficas generadas en:\n{carpeta}")
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            messagebox.showerror("Error al generar graficas", str(exc))

    def _generar_isofonas(self):
        if not self._verificar_procesado():
            return
        carpeta = filedialog.askdirectory(title="Carpeta donde guardar los mapas de isofonas")
        if not carpeta:
            return
        generadas = []
        errores = []
        for esquema in ESQUEMAS:
            etiqueta = ESQUEMA_LABELS[esquema]
            try:
                ruta = generar_mapa_isofonas_esquema(
                    self.resultados, esquema,
                    os.path.join(carpeta, f"isofonas_{esquema}.png"),
                    titulo=f"Mapa de isofonas - {etiqueta} - {self.proyecto.nombre_proyecto}",
                )
                self.rutas_isofonas[esquema] = ruta
                generadas.append(etiqueta)
            except SinCoordenadasError as exc:
                errores.append(f"{etiqueta}: {exc}")
            except Exception as exc:  # noqa: BLE001
                traceback.print_exc()
                errores.append(f"{etiqueta}: {exc}")

        if generadas:
            self._log(f"Mapas de isofonas generados en PNG y PDF ({', '.join(generadas)}) en: {carpeta}")
        for e in errores:
            self._log(f"No se genero mapa de isofonas - {e}")

        if generadas and not errores:
            messagebox.showinfo("Listo", f"Mapas de isofonas generados (.png y .pdf) en:\n{carpeta}")
        elif generadas and errores:
            messagebox.showwarning("Generado parcialmente", "\n\n".join(errores))
        else:
            messagebox.showerror(
                "No se pudo generar",
                "No se pudo generar ningun mapa de isofonas:\n\n" + "\n\n".join(errores)
                + "\n\nAsigne coordenadas (Este/Norte u origen nacional) a al menos 3 "
                  "puntos en la pestaña 1, en los campos de coordenadas del punto.",
            )

    def _generar_word(self):
        if not self._verificar_procesado():
            return
        plantilla = filedialog.askopenfilename(
            title="Seleccione la plantilla del informe (.docx)",
            initialfile=os.path.basename(PLANTILLA_DEFECTO),
            initialdir=os.path.dirname(PLANTILLA_DEFECTO),
            filetypes=[("Documento Word", "*.docx")],
        )
        if not plantilla:
            return
        salida = filedialog.asksaveasfilename(
            title="Guardar informe generado como", defaultextension=".docx",
            filetypes=[("Documento Word", "*.docx")],
        )
        if not salida:
            return

        if not self.rutas_graficas:
            carpeta_temp = os.path.join(os.path.dirname(salida), "graficas_informe")
            try:
                self.rutas_graficas = generar_graficas(self.resultados, carpeta_temp)
            except Exception:  # noqa: BLE001
                self.rutas_graficas = {}

        if not self.rutas_isofonas:
            carpeta_temp = os.path.join(os.path.dirname(salida), "isofonas_informe")
            for esquema in ESQUEMAS:
                try:
                    self.rutas_isofonas[esquema] = generar_mapa_isofonas_esquema(
                        self.resultados, esquema, os.path.join(carpeta_temp, f"isofonas_{esquema}.png"),
                    )
                except Exception:  # noqa: BLE001
                    pass  # sin coordenadas/resultados suficientes: se omite, no es un error fatal

        try:
            _, faltantes = generar_informe(
                self.resultados, plantilla, salida,
                graficas=self.rutas_graficas, isofonas=self.rutas_isofonas,
                ruta_equipos=RUTA_EQUIPOS if os.path.exists(RUTA_EQUIPOS) else None,
            )
            self._log(f"Informe Word generado en: {salida}")
            if faltantes:
                self._log("Tablas no encontradas en la plantilla: " + "; ".join(faltantes))
                messagebox.showwarning(
                    "Informe generado con advertencias",
                    f"Informe generado en:\n{salida}\n\n"
                    "No se encontraron en la plantilla (y por lo tanto quedaron sin llenar) "
                    "las siguientes tablas:\n- " + "\n- ".join(faltantes),
                )
            else:
                messagebox.showinfo("Listo", f"Informe generado en:\n{salida}")
        except ErrorPlantilla as exc:
            messagebox.showerror("Plantilla invalida", str(exc))
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            messagebox.showerror("Error al generar el informe", str(exc))

    def _verificar_procesado(self):
        if self.resultados is None:
            messagebox.showinfo("Falta procesar", "Primero use el boton '1) Procesar proyecto'.")
            return False
        return True


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
