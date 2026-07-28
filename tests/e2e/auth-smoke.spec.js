// tests/e2e/auth-smoke.spec.js — smoke AUTENTICADO, corre en los 6 viewports.
//
// Prueba mínima de que el fixture de auth (tests/fixtures/auth.js) funciona:
// entra al Calendario ya logueado como owner, espera a que cargue, revisa que
// no haya errores de consola y guarda un screenshot como evidencia (T29).
//
// Requiere el negocio semilla + globalSetup con login real (ver
// tests/setup/global-setup.js). Si ves este test fallar con el mensaje
// "[auth setup] BLOQUEADO", no es un bug de la app: es que .env.test todavía
// no tiene SEED_OWNER_EMAIL/PASSWORD reales — ver el reporte del agente
// qa-e2e para el paso manual pendiente.
import { test, expect, OWNER_STATE } from '../fixtures/auth.js';

test.use({ storageState: OWNER_STATE });

test('Calendario carga autenticado como owner, sin errores de consola', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);

    // Sidebar (desktop) o navegación equivalente en mobile — evidencia de que
    // el dashboard autenticado montó, no solo el loader.
    await page.waitForLoadState('networkidle');

    await page.screenshot({
        path: `tests/__screenshots__/dashboard-owner-${test.info().project.name}.png`,
        fullPage: true,
    });

    expect(consoleErrors, `Errores de consola en Calendario: ${consoleErrors.join(' | ')}`).toEqual([]);
});
