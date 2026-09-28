import { describe, expect, it } from "vitest";
import { detectDireccion } from "@/lib/direcciones";

describe("detectDireccion", () => {
  it.each([
    ["RA1_Norte.xlsx", "Norte"],
    ["P2 - oeste.xlsx", "Oeste"],
    ["punto 3 SUR diurno.xlsx", "Sur"],
    ["RA1-Este.xlsx", "Este"],
    ["RA1_vertical_DH.xlsx", "Vertical"],
    ["RA3_V.xlsx", "Vertical"],
    ["RA3_N.xlsx", "Norte"],
    ["RA3 O.xlsx", "Oeste"],
  ])("%s → %s", (name, expected) => {
    expect(detectDireccion(name)).toBe(expected);
  });

  it.each(["memoria.xlsx", "Norte y Sur.xlsx", "Sureste.xlsx", "N_S.xlsx"])("%s → null", (name) => {
    expect(detectDireccion(name)).toBeNull();
  });

  it("la palabra completa tiene prioridad sobre las letras", () => {
    expect(detectDireccion("RA1_Norte_S1.xlsx")).toBe("Norte");
  });
});
