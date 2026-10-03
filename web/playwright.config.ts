import { defineConfig, devices } from "@playwright/test";

/**
 * Prueba de extremo a extremo: la app (next start) y el motor deben estar
 * corriendo contra una base de datos vacía (ver .github/workflows/ci.yml).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 10 * 60 * 1000,
  expect: { timeout: 30 * 1000 },
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
});
