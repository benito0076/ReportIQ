import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { procesarAire } from "@/lib/engine";

const proyecto = {} as Parameters<typeof procesarAire>[0];

describe("cliente del motor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("ENGINE_URL", "https://motor.test");
    vi.stubEnv("ENGINE_API_KEY", "k");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reintenta mientras Render despierta el motor (429 sin detalle)", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Too Many Requests", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("<html>", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ estaciones: [] }));
    vi.stubGlobal("fetch", fetch);
    const p = procesarAire(proyecto);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ estaciones: [] });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("no reintenta los errores propios del motor", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ detail: "ENGINE_API_KEY no esta configurada." }, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(procesarAire(proyecto)).rejects.toThrow("ENGINE_API_KEY no esta configurada.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("se rinde con un mensaje claro si el motor no despierta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 429 })));
    const p = procesarAire(proyecto);
    const check = expect(p).rejects.toThrow("está iniciando o saturado");
    await vi.runAllTimersAsync();
    await check;
  });
});
