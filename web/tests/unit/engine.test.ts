import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { procesarAire } from "@/lib/engine";

const proyecto = {} as Parameters<typeof procesarAire>[0];

/** fetch simulado: /health responde `health` (en orden) y el resto `work`. */
function mockFetch(health: (() => Response)[], work: (() => Response)[]) {
  const calls = { health: 0, work: 0 };
  const fn = vi.fn(async (url: string) => {
    if (url.endsWith("/health")) {
      const r = health[Math.min(calls.health, health.length - 1)];
      calls.health++;
      return r();
    }
    const r = work[Math.min(calls.work, work.length - 1)];
    calls.work++;
    return r();
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const ok = () => Response.json({ status: "ok" });

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

  it("despierta el motor con /health antes de enviar el trabajo", async () => {
    const calls = mockFetch(
      [() => new Response("Too Many Requests", { status: 429, headers: { "retry-after": "2" } }), () => new Response("", { status: 502 }), ok],
      [() => Response.json({ estaciones: [] })],
    );
    const p = procesarAire(proyecto);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ estaciones: [] });
    expect(calls).toEqual({ health: 3, work: 1 });
  });

  it("reintenta los errores del proxy de Render (sin detalle)", async () => {
    const calls = mockFetch(
      [ok],
      [() => new Response("<html>", { status: 502 }), () => new Response("", { status: 503 }), () => Response.json({ estaciones: [] })],
    );
    const p = procesarAire(proyecto);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ estaciones: [] });
    expect(calls.work).toBe(3);
  });

  it("no reintenta los errores propios del motor", async () => {
    const calls = mockFetch([ok], [() => Response.json({ detail: "No se pudo descargar la plantilla." }, { status: 502 })]);
    await expect(procesarAire(proyecto)).rejects.toThrow("No se pudo descargar la plantilla.");
    expect(calls.work).toBe(1);
  });

  it("se rinde con un mensaje claro si el motor no despierta", async () => {
    mockFetch([() => new Response("", { status: 429 })], [() => new Response("", { status: 429 })]);
    const p = procesarAire(proyecto);
    const check = expect(p).rejects.toThrow("está iniciando o saturado");
    await vi.runAllTimersAsync();
    await check;
  });
});
