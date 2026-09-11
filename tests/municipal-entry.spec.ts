import { expect, test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("municipal district-first entry", () => {
  test("recovers from absent and invalid state with labelled, keyboard-ready entry", async ({ page }) => {
    await page.goto(`${baseURL}/alcaldes/versus`);

    const district = page.getByLabel("1. Tu municipalidad");
    await expect(district).toBeVisible();
    await expect(page.getByRole("heading", { name: "Encuentra y compara candidaturas de tu municipalidad" })).toBeVisible();

    await page.goto(`${baseURL}/alcaldes/versus?ambito=unknown&ambito=ate`);
    await expect(page.getByText("El distrito indicado en el enlace no es válido.")).toBeVisible();
    await expect(district).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "Todas" })).toBeFocused();
  });

  test("keeps a visible canonical Cercado notice and provides change/reset navigation", async ({ page }) => {
    await page.goto(`${baseURL}/alcaldes/versus?ambito=lima-cercado&prioridad=social`);

    await expect(page.getByText("Lima (Cercado) no elige una alcaldía distrital", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/ambito=lima-metropolitana/);
    await page.getByRole("button", { name: "Cambiar municipalidad" }).click();
    await expect(page.getByLabel("1. Tu municipalidad")).toBeFocused();

    await page.getByRole("button", { name: "Limpiar selección" }).click();
    await expect(page).toHaveURL(`${baseURL}/alcaldes/versus`);
  });

  test("offers a skip target and reflows the entry at narrow and zoomed layouts", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${baseURL}/alcaldes/versus`);

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Saltar al contenido principal" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();

    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => { document.body.style.zoom = "2"; });
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
