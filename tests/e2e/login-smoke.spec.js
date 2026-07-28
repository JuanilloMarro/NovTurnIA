// tests/e2e/login-smoke.spec.js — smoke SIN autenticar, corre en los 6 viewports.
//
// No depende del negocio semilla ni de credenciales: solo verifica que
// /login renderiza sin errores de consola y que el formulario está visible.
// Sirve como evidencia de que el harness (Playwright + webServer + Vite en
// modo test) funciona de punta a punta, independiente del bloqueo de
// auth.users documentado en el reporte del agente qa-e2e (ver .env.test.example).
import { test, expect } from '@playwright/test';

test('login carga sin errores de consola y el formulario es visible', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByText('NovTurnIA')).toBeVisible();

    await page.screenshot({
        path: `tests/__screenshots__/login-${test.info().project.name}.png`,
        fullPage: true,
    });

    expect(consoleErrors, `Errores de consola en /login: ${consoleErrors.join(' | ')}`).toEqual([]);
});
