// tests/e2e/outbound-cap.spec.js — F1/F2/F3 · tope de mensajes SALIENTES en el
// dashboard (Bloque 3 del Modelo de Negocio).
//
// Verifica las tres capas del lado del dashboard sobre el tenant semilla:
//   F2  barra de consumo de salientes (cupo, consumido, % — SOLO salientes)
//   F3  aviso al ≥80% con CTA "Comprar paquete" (deshabilitado — depende de B4)
//   F1  composer bloqueado al agotarse el cupo (input + botón deshabilitados)
//
// El estado de llenado se controla desde afuera vía la DB (usage_counters +
// businesses.limit_overrides.max_conversations del tenant semilla) y se pasa a
// este test por la env `OUTBOUND_STATE`. Consumo fijo del período: 90 salientes
// / 200 entrantes → el 90 (no el 290 total) es lo que debe leer la barra (B1).
//
//   OUTBOUND_STATE=normal   → cupo 200 · 90/200 = 45%  (sin aviso, sin bloqueo)
//   OUTBOUND_STATE=warning  → cupo 100 · 90/100 = 90%  (aviso visible)
//   OUTBOUND_STATE=blocked  → cupo  90 · 90/90 = 100%  (composer bloqueado)
//
// Correr un estado a la vez (la DB se setea antes con MCP):
//   OUTBOUND_STATE=normal  npx playwright test outbound-cap --project=desktop
import { test, expect, OWNER_STATE } from '../fixtures/auth.js';

test.use({ storageState: OWNER_STATE });

// Paciente del tenant semilla — se auto-selecciona vía ?patient= (Conversations.jsx)
// para que el composer quede montado y visible en el screenshot.
const SEED_PATIENT = '2aa99df2-0060-49af-b823-e42bf2858abf';

const STATE = process.env.OUTBOUND_STATE || 'normal';
const EXPECT = {
    normal:  { quota: '90 de 200', pct: '45%',  notice: false, composerBlocked: false },
    warning: { quota: '90 de 100', pct: '90%',  notice: true,  composerBlocked: false },
    blocked: { quota: '90 de 90',  pct: '100%', notice: true,  composerBlocked: true  },
}[STATE];

test(`F1/F2/F3 · cupo de salientes · estado=${STATE}`, async ({ page }) => {
    expect(EXPECT, `OUTBOUND_STATE inválido: ${STATE}`).toBeTruthy();

    await page.goto(`/conversations?patient=${SEED_PATIENT}`);
    await expect(page).not.toHaveURL(/\/login/);

    // F2 — la barra de salientes debe montar con el consumo real (solo salientes).
    const bar = page.locator('[aria-label*="mensajes salientes este mes"]');
    await expect(bar).toBeVisible({ timeout: 15_000 });
    await expect(bar).toHaveAttribute('aria-label', new RegExp(EXPECT.quota));
    // Prueba B1: el CONSUMIDO (primer número) es 90 = salientes, NUNCA 290 (in+out)
    // ni 200 (entrantes). El formato es "{consumido} de {cupo} mensajes...".
    await expect(bar).not.toHaveAttribute('aria-label', /^(290|200) de/);

    // F3 — aviso + CTA "Comprar paquete" (deshabilitado por B4).
    const buyBtn = page.getByRole('button', { name: /Comprar paquete/ });
    if (EXPECT.notice) {
        await expect(buyBtn).toBeVisible();
        await expect(buyBtn).toBeDisabled();
        await expect(page.getByRole('status')).toContainText(
            EXPECT.composerBlocked ? /agot/i : new RegExp(EXPECT.pct)
        );
    } else {
        await expect(buyBtn).toHaveCount(0);
    }

    // F1 — composer. El textarea siempre monta con paciente seleccionado.
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    const sendBtn = page.getByRole('button', { name: 'Enviar mensaje' });

    if (EXPECT.composerBlocked) {
        // Cupo agotado: input + botón deshabilitados con mensaje claro de cupo.
        await expect(textarea).toBeDisabled();
        await expect(textarea).toHaveAttribute('placeholder', 'Cupo de mensajes del mes agotado');
        await expect(sendBtn).toBeDisabled();
    } else {
        // Sin bloqueo por cupo: el placeholder NO es el de cupo agotado (puede
        // estar deshabilitado por la ventana de 24h — gate aparte, no de cupo).
        await expect(textarea).not.toHaveAttribute('placeholder', 'Cupo de mensajes del mes agotado');
    }

    await page.screenshot({ path: `tests/__screenshots__/outbound-${STATE}.png`, fullPage: true });
});
