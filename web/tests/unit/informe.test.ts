import { describe, expect, it } from "vitest";
import { informePayload } from "@/lib/informe";
import { INFORME_CAMPOS, informeSchema, parseOrThrow } from "@/lib/validation";

const firmas = { elaboroNombre: "Ana", elaboroCargo: "Coordinadora", autorizoNombre: "", autorizoCargo: "" };

describe("informePayload", () => {
  it("usa las claves del motor e incluye las firmas", () => {
    const p = informePayload({ areaEstudio: "el área X", clienteNit: "900", version: "2.0" }, firmas);
    expect(p).toMatchObject({ area_estudio: "el área X", cliente_nit: "900", version: "2.0", elaboro_nombre: "Ana" });
  });

  it("omite la versión vacía para que el motor use 1.0", () => {
    expect(informePayload({ version: "" }, firmas)).not.toHaveProperty("version");
  });
});

describe("informeSchema", () => {
  it("valida la fecha", () => {
    const vacio = Object.fromEntries(INFORME_CAMPOS.map((k) => [k, ""]));
    expect(parseOrThrow(informeSchema, { ...vacio, fecha: "2026-09-15" }).fecha).toBe("2026-09-15");
    expect(() => parseOrThrow(informeSchema, { ...vacio, fecha: "15/09/2026" })).toThrow();
  });
});
