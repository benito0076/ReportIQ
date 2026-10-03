import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Recorrido completo sobre una base de datos vacía: configuración inicial,
 * usuarios, proyecto de ruido con memorias sintéticas, procesamiento, informe
 * Word, aprobación (devolver → reenviar → aprobar), duplicado y límite de
 * intentos de inicio de sesión.
 */

const CLAVE = "Prueba-E2E-2026";
const ADMIN = { nombre: "Admin E2E", email: "admin@e2e.test" };
const TECNICO = { nombre: "Ing. Laura Gómez", cargo: "Ingeniera de campo", email: "tecnico@e2e.test" };
const APROBADOR = { nombre: "Ing. Luis Rojas", cargo: "Director técnico", email: "aprobador@e2e.test" };
const FIXTURES = path.resolve("e2e/.fixtures"); // se ejecuta desde web/

test.describe.configure({ mode: "serial" });

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", CLAVE);
  await page.click("button[type=submit]");
  await page.waitForURL("**/inicio");
}

async function salir(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("**/login");
}

async function crearUsuario(page: Page, u: { nombre: string; cargo: string; email: string }, rol: string) {
  await page.goto("/usuarios");
  await page.fill("#fullName", u.nombre);
  await page.fill("#cargo", u.cargo);
  await page.fill("#email", u.email);
  await page.fill("#password", CLAVE);
  await page.selectOption("#role", rol);
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Usuario creado")).toBeVisible();
}

let proyectoUrl = "";

test("configuración inicial y usuarios", async ({ page }) => {
  await page.goto("/setup");
  await page.fill("#fullName", ADMIN.nombre);
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", CLAVE);
  await page.getByRole("button", { name: "Crear administrador" }).click();
  await page.waitForURL("**/inicio");
  await crearUsuario(page, TECNICO, "user");
  await crearUsuario(page, APROBADOR, "aprobador");
  await salir(page);
});

test("el técnico crea, procesa y envía a revisión un informe de ruido", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await entrar(page, TECNICO.email);

  // «Nuevo proyecto» pregunta la matriz.
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByRole("dialog").getByRole("link", { name: /Ruido/ }).click();
  await page.waitForURL(/\/proyectos(\?|$)/);
  await expect(page.locator("#nuevo #nombre")).toBeFocused();
  await page.fill("#nuevo #nombre", "Monitoreo E2E");
  await page.fill("#nuevo #cliente", "Cliente E2E S.A.S.");
  await page.fill("#nuevo #codigoInforme", "ER-900-26");
  await page.locator("#nuevo").getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/proyectos\/[0-9a-f-]{36}/);
  proyectoUrl = page.url().replace(/\/(puntos|memorias|resultados).*$/, "");

  // Punto de medición.
  await page.goto(`${proyectoUrl}/puntos/nuevo`);
  await page.fill("#nombre", "P1");
  await page.locator("#sector").selectOption({ index: 1 });
  await page.fill("#este", "4919855,125");
  await page.fill("#norte", "2309786,167");
  await page.getByRole("button", { name: /Guardar|Agregar|Crear/ }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/nuevo"));

  // Memorias del sonómetro (las 5 direcciones de la jornada diurna hábil).
  await page.goto(`${proyectoUrl}/memorias`);
  const archivos = ["Vertical", "Norte", "Sur", "Este", "Oeste"].map((d) => path.join(FIXTURES, `P1_${d}.xlsx`));
  await page.locator("input[type=file][multiple]").first().setInputFiles(archivos);
  await expect(page.getByText("P1_Oeste.xlsx")).toBeVisible({ timeout: 60_000 });

  // Procesar y generar el informe Word.
  await page.goto(`${proyectoUrl}/resultados`);
  await page.getByRole("button", { name: "Procesar proyecto" }).click();
  await expect(page.getByRole("button", { name: "Informe Word" })).toBeEnabled({ timeout: 120_000 });
  await page.getByRole("button", { name: "Informe Word" }).click();
  const informes = page.locator("#informes");
  await expect(informes.getByText("Borrador", { exact: true })).toBeVisible({ timeout: 300_000 });

  await informes.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(informes.getByText("En revisión", { exact: true })).toBeVisible();
  // Quien elaboró no puede aprobar.
  await expect(informes.getByRole("button", { name: "Aprobar" })).toHaveCount(0);
  await salir(page);
});

test("el aprobador devuelve, el técnico reenvía y el aprobador aprueba", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await entrar(page, APROBADOR.email);
  await page.getByRole("link", { name: /Por aprobar/ }).first().click();
  await page.getByRole("link", { name: "Revisar" }).first().click();
  const informes = page.locator("#informes");
  await informes.getByRole("button", { name: "Devolver" }).click();
  await informes.locator("textarea[name=observaciones]").fill("Revisar la descripción del punto P1.");
  await informes.locator("form").getByRole("button", { name: "Devolver" }).click();
  await expect(informes.getByText("Devuelto", { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, TECNICO.email);
  await expect(page.getByText("Revisar la descripción del punto P1.")).toBeVisible();
  await page.goto(`${proyectoUrl}/resultados`);
  await page.locator("#informes").getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.locator("#informes").getByText("En revisión", { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, APROBADOR.email);
  await page.goto(`${proyectoUrl}/resultados#informes`);
  await page.locator("#informes").getByRole("button", { name: "Aprobar" }).click();
  await expect(page.locator("#informes").getByText("Aprobado", { exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("#informes").getByText(/aprobado\.docx/)).toBeVisible();
  await salir(page);
});

test("duplicar el proyecto para un nuevo monitoreo", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await entrar(page, TECNICO.email);
  await page.goto(proyectoUrl);
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByRole("heading", { name: "Monitoreo E2E (copia)" })).toBeVisible({ timeout: 60_000 });
  // La copia conserva el punto (sin memorias ni informes) y deja el código vacío.
  expect(page.url()).not.toBe(proyectoUrl);
  await expect(page.getByRole("cell", { name: "P1", exact: true })).toBeVisible();
});

test("bloqueo tras 5 intentos fallidos de inicio de sesión", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.fill("#email", "nadie@e2e.test");
    await page.fill("#password", "clave-equivocada");
    await page.click("button[type=submit]");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  }
  await page.goto("/login");
  await page.fill("#email", "nadie@e2e.test");
  await page.fill("#password", "clave-equivocada");
  await page.click("button[type=submit]");
  await expect(page.getByText(/Demasiados intentos fallidos/)).toBeVisible();
});
