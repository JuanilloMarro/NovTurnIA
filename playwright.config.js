// playwright.config.js — Harness E2E de NovTurnIA (QA fase A)
//
// Qué hace este archivo:
//   1. Carga `.env.test` (nunca `.env` de desarrollo ni de producción).
//   2. Levanta la app con `vite --mode test` (Vite carga `.env.test` solo).
//   3. Corre `globalSetup` UNA VEZ antes de toda la corrida: hace login real
//      contra Supabase Auth como `owner` y como `secretary`, y cachea el
//      storageState de cada uno en `playwright/.auth/*.json`. Los tests
//      importan esas rutas desde `tests/fixtures/auth.js` — nunca hacen
//      login por su cuenta (ver el comentario de cabecera de ese archivo).
//   4. Define un proyecto por viewport — T29 (breakpoints) + T28 (landscape).
//
// Variables requeridas en `.env.test` (ver `.env.test.example`):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   → cliente de Supabase de la app
//   SEED_BUSINESS_ID                            → negocio semilla (tests/seed)
//   SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD       → login real, rol owner
//   SEED_SECRETARY_EMAIL / SEED_SECRETARY_PASSWORD → login real, rol secretary
//
// Si esas variables no existen, `globalSetup` falla rápido con un mensaje
// explícito en vez de dejar que cada test falle por su cuenta con un timeout
// de login críptico.

import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Node >=20.6 trae process.loadEnvFile() nativo — evita sumar la dependencia
// `dotenv` solo para esto. Silencioso si .env.test todavía no existe (primer
// clone del harness antes de correr el seed).
try {
    process.loadEnvFile(path.join(__dirname, '.env.test'));
} catch {
    console.warn('[playwright.config] No se encontró .env.test — copiá .env.test.example y completá los valores.');
}

// 5183 (no 5173) a propósito: evita chocar con un `npm run dev` que ya esté
// corriendo en el repo principal mientras este worktree corre sus tests.
const PORT = Number(process.env.PLAYWRIGHT_PORT || 5183);
// "localhost", no 127.0.0.1: en este entorno Vite bindea solo IPv6 (::1) por
// default y un healthcheck a la IPv4 literal nunca conecta.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

// Viewports pedidos por el backlog: T29 (recorrido responsive autenticado)
// y T28 (landscape 812×375). deviceScaleFactor:1 en todos — no simulamos
// densidad de píxel, solo el breakpoint.
const VIEWPORTS = {
    mobile:      { width: 375, height: 812 },   // iPhone SE/12 mini — T29
    'mobile-lg': { width: 414, height: 896 },   // iPhone 11/XR — T29
    tablet:      { width: 768, height: 1024 },  // el "acantilado" de los 768px — T29
    ipad:        { width: 834, height: 1112 },  // iPad Air/Pro 11" — T29
    desktop:     { width: 1280, height: 800 },  // layout de escritorio — T29
    landscape:   { width: 812, height: 375 },   // T28 — mobile en horizontal
};

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],
    globalSetup: './tests/setup/global-setup.js',
    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    // Reusa un server ya corriendo en local (evita choques de puerto entre
    // corridas manuales); en CI siempre levanta uno propio y limpio.
    webServer: {
        command: `npm run dev -- --mode test --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
    projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
        name,
        use: {
            browserName: 'chromium',
            viewport,
            isMobile: name !== 'desktop',
            hasTouch: name !== 'desktop',
        },
    })),
});
