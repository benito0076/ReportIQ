import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { SECTORES, coordenadaFueraDeColombia, parseDecimal, parseOrThrow, pointSchema } from "@/lib/validation";

const base = { nombre: "RA1", sector: "", incertidumbre: "0,0043", este: "", norte: "", altitud: "", descripcion: "", fuentes: "" };

describe("pointSchema", () => {
  it("acepta coma decimal y sector de la lista", () => {
    const p = parseOrThrow(pointSchema, { ...base, sector: SECTORES[1].etiqueta, este: "4919855,125", norte: "2309786.167" });
    expect(p.incertidumbre).toBeCloseTo(0.0043);
    expect(p.este).toBe("4919855,125");
  });

  it("rechaza sectores fuera de la tabla y coordenadas no numéricas", () => {
    try {
      parseOrThrow(pointSchema, { ...base, sector: "Z - inventado", este: "abc" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(Object.keys((e as ValidationError).fieldErrors).sort()).toEqual(["este", "sector"]);
    }
  });

  it("rechaza incertidumbre negativa", () => {
    expect(() => parseOrThrow(pointSchema, { ...base, incertidumbre: "-1" })).toThrow(ValidationError);
  });
});

describe("parseDecimal", () => {
  it.each([
    ["57,8", 57.8],
    ["-74.1", -74.1],
    ["", null],
    ["1.2.3", null],
  ])("%s → %s", (v, expected) => {
    expect(parseDecimal(v)).toBe(expected);
  });
});

describe("coordenadaFueraDeColombia", () => {
  it("acepta Origen Nacional y grados decimales dentro de Colombia", () => {
    expect(coordenadaFueraDeColombia("4874000", "2214000")).toBeNull();
    expect(coordenadaFueraDeColombia("4.874.000,5", "2.214.000")).toBeNull();
    expect(coordenadaFueraDeColombia("-74.0721", "4.7110")).toBeNull();
    expect(coordenadaFueraDeColombia("73°33'40\"O", "4°N")).toBeNull(); // DMS: lo valida el motor
    expect(coordenadaFueraDeColombia("", "")).toBeNull();
  });

  it("rechaza puntos fuera de Colombia", () => {
    expect(coordenadaFueraDeColombia("7727100", "13198600")?.campo).toBe("longitud");
    expect(coordenadaFueraDeColombia("4874000", "13198600")?.campo).toBe("latitud");
    expect(coordenadaFueraDeColombia("2.35", "48.85")?.campo).toBe("longitud");
  });
});
