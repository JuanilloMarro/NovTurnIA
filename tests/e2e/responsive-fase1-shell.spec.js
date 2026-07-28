// tests/e2e/responsive-fase1-shell.spec.js — verificación de Fase 1 (shell) del
// agente `responsive`: T1 (h-[100dvh]), T2 (marco disuelto en móvil),
// T3 (safe areas), T4 (inputs a 16px en móvil), T5 (orbes ocultos bajo `sm`).
//
// Corre en los 6 proyectos/viewport de playwright.config.js (mobile, mobile-lg,
// tablet, ipad, desktop, landscape). Cada aserción deriva el valor esperado del
// ANCHO REAL del viewport del proyecto (no hardcodea por nombre), así el mismo
// test documenta la regla en vez de solo repetirla:
//   < 640   (sm)  → marco disuelto: padding 0, sin radio, sin borde, sin sombra,
//                   inputs a 16px, orbes ocultos.
//   640–1023      → gutter 1rem (16px), radio 24px, borde+sombra visibles,
//                   inputs vuelven a 13px, orbes visibles.
//   >= 1024 (lg)  → gutter 1.5rem (24px), radio 32px — MISMO valor final que
//                   antes del cambio (rounded-[32px] sin variante `lg` previa),
//                   por eso 1280px no se mueve un píxel.
//
// Nota sobre T3 (safe areas): Chromium headless no tiene muesca ni gesture bar,
// así que `env(safe-area-inset-*)` siempre resuelve a 0px en este harness — no
// hay forma de fabricar un inset real sin un dispositivo físico. Lo que SÍ se
// verifica acá es que la fórmula `max(env(...), gutter)` está correctamente
// cableada: con inset=0, el resultado tiene que coincidir exactamente con el
// gutter puro (0 / 1rem / 1.5rem) en cada breakpoint — si esa aritmética
// estuviera mal, estos números no coincidirían. Evidencia complementaria
// (que el atributo de la regla es la correcta) queda en el screenshot + el
// diff de código, no en una aserción ejecutable de inset real.
import { test as authTest, expect as authExpect, OWNER_STATE } from '../fixtures/auth.js';
import { test as publicTest, expect as publicExpect } from '@playwright/test';

function expectedShellPadding(width) {
    if (width < 640) return 0;
    if (width < 1024) return 16; // 1rem
    return 24; // 1.5rem
}

function expectedRadius(width) {
    if (width < 640) return 0;
    if (width < 1024) return 24;
    return 32;
}

function expectedInputFontPx(width) {
    // T4: text-[16px] sm:text-[13px] — 16px SOLO bajo 640, 13px desde ahí.
    return width < 640 ? 16 : 13;
}

function expectedOrbDisplay(width) {
    // T5: hidden sm:block — 'none' bajo 640, 'block' desde ahí.
    return width < 640 ? 'none' : 'block';
}

// ─────────────────────────────────────────────────────────────────────────
// T1 + T3 + T4 + T5 — /login (pública, sin fixture de auth)
// ─────────────────────────────────────────────────────────────────────────
publicTest('Fase 1 shell — /login: dvh, safe-area-card, inputs 16px, orbes ocultos bajo sm', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport.width;

    await page.goto('/login');
    await publicExpect(page.locator('input[type="email"]')).toBeVisible();

    // T1 — el wrapper usa min-h-[100dvh], no min-h-screen.
    const wrapper = page.locator('div.min-h-\\[100dvh\\].safe-area-card');
    await publicExpect(wrapper).toHaveCount(1);

    // T3 — con env()=0 en Chromium headless, max(env,1rem) debe resolver a
    // exactamente 16px en los 4 lados (mismo valor que el p-4 que reemplaza).
    const padding = await wrapper.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { top: parseFloat(cs.paddingTop), left: parseFloat(cs.paddingLeft) };
    });
    publicExpect(padding.top).toBe(16);
    publicExpect(padding.left).toBe(16);

    // T4 — inputs de email/password: 16px bajo 640, 13px desde ahí (evita el
    // zoom automático de Safari iOS al enfocar un input <16px).
    const emailFontSize = await page.locator('input[type="email"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const passFontSize = await page.locator('input[type="password"]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    publicExpect(emailFontSize).toBe(expectedInputFontPx(width));
    publicExpect(passFontSize).toBe(expectedInputFontPx(width));

    // T5 — los 2 orbes .lg-orb: display:none bajo 640, block desde ahí.
    const orbDisplays = await page.locator('.lg-orb').evaluateAll((els) => els.map((el) => getComputedStyle(el).display));
    publicExpect(orbDisplays).toHaveLength(2);
    for (const d of orbDisplays) publicExpect(d).toBe(expectedOrbDisplay(width));

    await page.screenshot({
        path: `tests/__screenshots__/fase1-shell-login-${testInfo.project.name}.png`,
        fullPage: true,
    });
});

// ─────────────────────────────────────────────────────────────────────────
// T1 + T2 + T3 — shell principal autenticado (Calendario, ruta "/")
// ─────────────────────────────────────────────────────────────────────────
authTest.use({ storageState: OWNER_STATE });

authTest('Fase 1 shell — dashboard: dvh, marco disuelto y safe-area-shell bajo sm', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport.width;

    await page.goto('/');
    await authExpect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');

    // T1 — el contenedor raíz del shell usa h-[100dvh], no h-screen.
    const outer = page.locator('div.h-\\[100dvh\\].safe-area-shell');
    await authExpect(outer).toHaveCount(1);

    // T3 — misma verificación aritmética que en /login, pero con la escala de
    // 3 pasos del shell (0 / 1rem / 1.5rem) en vez de la fija de la tarjeta.
    const padding = await outer.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { top: parseFloat(cs.paddingTop), left: parseFloat(cs.paddingLeft) };
    });
    authExpect(padding.top).toBe(expectedShellPadding(width));
    authExpect(padding.left).toBe(expectedShellPadding(width));

    // T2 — el marco de vidrio (primer hijo directo del outer): radio, borde y
    // sombra colapsan a 0/ninguno bajo `sm`, y a partir de ahí escalan
    // 24px (tablet) → 32px (desktop, lg) — el mismo valor final de antes.
    const frame = outer.locator('> div').first();
    const frameStyle = await frame.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
            radius: parseFloat(cs.borderTopLeftRadius),
            borderWidth: parseFloat(cs.borderTopWidth),
            boxShadow: cs.boxShadow,
        };
    });
    authExpect(frameStyle.radius).toBe(expectedRadius(width));
    if (width < 640) {
        authExpect(frameStyle.borderWidth).toBe(0);
        authExpect(frameStyle.boxShadow).toBe('none');
    } else {
        authExpect(frameStyle.borderWidth).toBeGreaterThan(0);
        authExpect(frameStyle.boxShadow).not.toBe('none');
    }

    await page.screenshot({
        path: `tests/__screenshots__/fase1-shell-dashboard-${testInfo.project.name}.png`,
        fullPage: true,
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Guardia de escritorio — a 1280px (proyecto "desktop") nada de lo de arriba
// puede moverse un píxel respecto del layout pre-Fase-1: mismo padding (24px),
// mismo radio (32px), borde y sombra siempre presentes, inputs a 13px, orbes
// visibles. Falla si algún ítem de la Fase 1 "se filtró" a escritorio.
// ─────────────────────────────────────────────────────────────────────────
authTest('Fase 1 shell — a 1280px el escritorio queda exactamente igual', async ({ page }, testInfo) => {
    authTest.skip(testInfo.project.name !== 'desktop', 'Solo aplica al proyecto desktop (1280px)');

    await page.goto('/');
    await authExpect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');

    const outer = page.locator('div.h-\\[100dvh\\].safe-area-shell');
    const frame = outer.locator('> div').first();
    const style = await frame.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
            radius: parseFloat(cs.borderTopLeftRadius),
            borderWidth: parseFloat(cs.borderTopWidth),
            boxShadow: cs.boxShadow,
        };
    });
    authExpect(style.radius).toBe(32);
    authExpect(style.borderWidth).toBe(1);
    authExpect(style.boxShadow).not.toBe('none');

    const padding = await outer.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    authExpect(padding).toBe(24);
});
