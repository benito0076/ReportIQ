import { describe, expect, it } from "vitest";
import { UPLOAD_RULES, extensionFor, matchesRule, sniff } from "@/lib/files";

describe("sniff", () => {
  it("reconoce xlsx/docx (zip), jpg y png", () => {
    expect(sniff(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe("zip");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(sniff(new TextEncoder().encode("hola"))).toBeNull();
  });

  it("aplica la regla de cada tipo", () => {
    expect(matchesRule("zip", UPLOAD_RULES.memoria)).toBe(true);
    expect(matchesRule("jpg", UPLOAD_RULES.memoria)).toBe(false);
    expect(matchesRule("png", UPLOAD_RULES.foto)).toBe(true);
    expect(matchesRule("zip", UPLOAD_RULES.foto)).toBe(false);
    expect(matchesRule("pdf", UPLOAD_RULES.laboratorio)).toBe(true);
    expect(matchesRule("zip", UPLOAD_RULES.laboratorio)).toBe(false);
    expect(matchesRule("pdf", UPLOAD_RULES.fp004)).toBe(false);
  });

  it("reconoce el PDF del laboratorio", () => {
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(extensionFor("laboratorio", "reporte.PDF")).toBe("pdf");
    expect(extensionFor("fp004", "FP-004.xlsx")).toBe("xlsx");
  });

  it("elige la extensión de almacenamiento", () => {
    expect(extensionFor("memoria", "x.XLSX")).toBe("xlsx");
    expect(extensionFor("foto", "foto.PNG")).toBe("png");
    expect(extensionFor("foto", "foto.heic")).toBe("jpg");
  });
});
