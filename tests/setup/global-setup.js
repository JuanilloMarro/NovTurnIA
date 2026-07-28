// tests/setup/global-setup.js — login real vía Supabase Auth, una vez por corrida.
//
// Corre ANTES de todos los proyectos (ver `globalSetup` en playwright.config.js).
// Para cada rol (owner, secretary):
//   1. Abre /login en un browser real.
//   2. Llena el formulario y lo envía (mismo código que usaría una persona —
//      no llama a supabase.auth.signInWithPassword() por su cuenta, así el
//      test también cubre que el formulario de login funcione).
//   3. Espera a salir de /login (login exitoso) o levanta un error legible.
//   4. Guarda el storageState (cookies + localStorage, incluida la sesión de
//      Supabase) en playwright/.auth/<rol>.json.
//
// Los archivos resultantes son consumidos por tests/fixtures/auth.js — nadie
// más debería leer esas rutas directamente.
//
// Requiere en `.env.test`: SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD,
// SEED_SECRETARY_EMAIL, SEED_SECRETARY_PASSWORD. Si faltan, este paso NO
// tumba toda la corrida: avisa por consola y sigue sin generar los
// storageState. Los tests que no dependen de auth (login-smoke.spec.js)
// corren igual; los que sí dependen (auth-smoke.spec.js y cualquier test que
// importe tests/fixtures/auth.js) fallan individualmente con un error claro
// de Playwright ("no such file") al no encontrar playwright/.auth/<rol>.json
// — así un blocker de credenciales no esconde regresiones reales en el resto
// del harness.

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.resolve(__dirname, '../../playwright/.auth');

const ROLES = [
    { name: 'owner', emailVar: 'SEED_OWNER_EMAIL', passwordVar: 'SEED_OWNER_PASSWORD' },
    { name: 'secretary', emailVar: 'SEED_SECRETARY_EMAIL', passwordVar: 'SEED_SECRETARY_PASSWORD' },
];

async function loginAs(browser, baseURL, { name, email, password }) {
    const statePath = path.join(AUTH_DIR, `${name}.json`);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(`${baseURL}/login`);
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(password);
        await page.locator('button[type="submit"]').click();

        // Login exitoso == navegamos fuera de /login. Si las credenciales son
        // malas, Login.jsx muestra un error en la misma pantalla y nunca navega.
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    } catch (err) {
        const errorBanner = await page.locator('text=Credenciales incorrectas').isVisible().catch(() => false);
        throw new Error(
            `[auth setup] No se pudo iniciar sesión como "${name}" (${email}). ` +
            (errorBanner
                ? 'El formulario respondió "Credenciales incorrectas" — revisá SEED_OWNER_EMAIL/PASSWORD en .env.test.'
                : `Detalle: ${err.message}`)
        );
    }

    await context.storageState({ path: statePath });
    await context.close();
}

export default async function globalSetup(config) {
    const baseURL = config.projects[0]?.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5183';

    fs.mkdirSync(AUTH_DIR, { recursive: true });

    const missing = [];
    const roles = ROLES.map(r => {
        const email = process.env[r.emailVar];
        const password = process.env[r.passwordVar];
        if (!email || !password) missing.push(r.emailVar, r.passwordVar);
        return { name: r.name, email, password };
    });

    if (missing.length) {
        console.warn(
            '\n[auth setup] AVISO — faltan variables en .env.test: ' + [...new Set(missing)].join(', ') + '\n' +
            'No se genera playwright/.auth/*.json. Los tests SIN autenticar (login-smoke.spec.js) van a ' +
            'correr igual; cualquier test que dependa de tests/fixtures/auth.js va a fallar con un error ' +
            'de Playwright del tipo "ENOENT ... owner.json" — es la señal correcta de que falta el paso ' +
            'manual descrito en el reporte del agente qa-e2e (creación del negocio semilla vía ' +
            '/admin/new-tenant, exclusivo del super-admin), no una regresión de la app.\n'
        );
        return;
    }

    const browser = await chromium.launch();
    try {
        for (const role of roles) {
            await loginAs(browser, baseURL, role);
        }
    } finally {
        await browser.close();
    }
}
