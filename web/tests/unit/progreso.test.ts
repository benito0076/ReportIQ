import { describe, expect, it } from "vitest";
import { revisarAire, revisarVertimiento } from "@/lib/progreso";
import { normalizarPunto, puntoParaReporte } from "@/lib/puntos";

const firmas = { elaboroNombre: "Ing. A", autorizoNombre: "Dir. B" };
const punto = (nombre: string, extra: Partial<Parameters<typeof revisarVertimiento>[0]["puntos"][number]> = {}) => ({
  nombre,
  informeKey: "k.pdf",
  fotoKey: "f.jpg",
  latitud: "4.96",
  longitud: "-73.95",
  descripcion: "Salida de la PTAR",
  ...extra,
});

describe("revisarVertimiento", () => {
  const base = {
    cliente: "Cliente",
    codigo: "EA-1",
    actividades: 1,
    puntos: [punto("Salida")],
    fp004: true,
    informe: { municipio: "Bogotá", clienteActividad: "Alimentos" },
    procesado: true,
    cruzados: [],
    subcontratados: false,
    firmas,
  };

  it("todo completo: pasos listos y sin avisos", () => {
    const r = revisarVertimiento(base);
    expect(r.pasos.map((p) => p.estado)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"]);
    expect(r.avisos).toEqual([]);
  });

  it("sin reportes bloquea y lista lo que falta", () => {
    const r = revisarVertimiento({
      ...base,
      puntos: [punto("Entrada", { informeKey: null, latitud: "", descripcion: "", fotoKey: null })],
      fp004: false,
      subcontratados: true,
      informe: {},
      cruzados: [{ punto: "Entrada", laboratorio: "Salida" }],
    });
    expect(r.avisos[0]).toMatchObject({ nivel: "bloquea" });
    const textos = r.avisos.map((a) => a.texto).join(" | ");
    for (const t of ["Sin coordenadas", "Sin descripción", "foto", "FP-004", "actividad del cliente", "subcontratado", "cruzados"]) {
      expect(textos).toContain(t);
    }
    expect(r.pasos.find((p) => p.titulo === "Puntos")?.detalle).toBe("0/1 con reporte");
  });
});

describe("revisarAire", () => {
  it("sin plantillas bloquea; las estaciones sin datos se avisan", () => {
    const r = revisarAire({
      cliente: "C",
      codigo: "EC-1",
      estaciones: [{ numero: 1, nombre: "", latitud: "", longitud: "", descripcion: "", fotoKey: null }],
      plantillas: 0,
      meteo: false,
      informe: {},
      procesado: false,
      firmas: { elaboroNombre: "", autorizoNombre: "" },
    });
    expect(r.avisos[0]).toMatchObject({ nivel: "bloquea" });
    expect(r.avisos.map((a) => a.texto).join(" ")).toContain("Estación 1");
    expect(r.avisos.at(-1)?.texto).toContain("firmas");
  });
});

describe("puntoParaReporte", () => {
  const puntos = [{ nombre: "Entrada sistema de tratamiento" }, { nombre: "Salida sistema de tratamiento" }];
  it("asigna por nombre sin tildes, artículos ni mayúsculas", () => {
    expect(normalizarPunto("Salida del Sistema de Tratamiento")).toBe("salida sistema tratamiento");
    expect(puntoParaReporte(puntos, "SALIDA DEL SISTEMA DE TRATAMIENTO")?.nombre).toBe("Salida sistema de tratamiento");
  });
  it("acepta nombres contenidos uno en otro solo si no es ambiguo", () => {
    expect(puntoParaReporte(puntos, "Entrada")?.nombre).toBe("Entrada sistema de tratamiento");
    expect(puntoParaReporte(puntos, "sistema de tratamiento")).toBeUndefined();
    expect(puntoParaReporte(puntos, "Pozo séptico")).toBeUndefined();
  });
});
