// tests/fixtures/auth.js — FIXTURE DE AUTENTICACIÓN COMPARTIDA DE LA FLOTA
// ═══════════════════════════════════════════════════════════════════════════
// Construido por el agente qa-e2e (T29 / COD-7). Es el ÚNICO punto de entrada
// para escribir tests autenticados contra NovTurnIA. Todos los demás agentes
// (responsive, seguridad-rls, costos-negocio, edge-backend, etc.) importan
// de acá — no repliquen login a mano en otro lado.
//
// QUÉ HACE
// --------
// El login real ya ocurrió UNA VEZ en `tests/setup/global-setup.js` (se
// ejecuta automáticamente antes de la corrida vía `globalSetup` en
// playwright.config.js). Ese paso guardó el storageState de sesión de
// Supabase Auth de dos usuarios reales del negocio semilla:
//   - owner     → todos los permisos (ver OWNER_PERMISSIONS en
//                 supabase/functions/onboard-tenant/index.ts)
//   - secretary → permisos operativos, sin borrar/ver stats/gestionar roles
//                 (ver SECRETARY_PERMISSIONS en el mismo archivo)
//
// Este módulo NO hace red ni login — solo apunta a esos archivos cacheados
// y expone un `test` extendido de Playwright con fixtures listas para usar.
//
// CÓMO IMPORTARLO (API pública)
// ------------------------------
//   import { test, expect } from '../fixtures/auth.js';
//
//   // Opción A — todo el archivo/describe corre como un solo rol (recomendado
//   // para recorridos normales de un módulo: más rápido, un solo storageState):
//   test.use({ storageState: OWNER_STATE });
//   test('Calendario carga sin errores', async ({ page }) => { ... });
//
//   // Opción B — necesitás AMBOS roles en el mismo test (p. ej. probar que
//   // secretary no ve el botón "Eliminar" que owner sí ve):
//   test('permisos: eliminar paciente', async ({ ownerPage, secretaryPage }) => {
//       await ownerPage.goto('/patients');
//       await secretaryPage.goto('/patients');
//       ...
//   });
//
// Cada fixture (`ownerPage`, `secretaryPage`) es una página con su propio
// BrowserContext ya autenticado, con el viewport del proyecto actual
// (mobile/mobile-lg/tablet/ipad/desktop/landscape) heredado correctamente.
//
// RUTAS DE LOS 9 MÓDULOS AUTENTICADOS (para armar recorridos, ver COD-7/T29)
//   /            Calendario       /patients   Pacientes    /followup  Seguimiento
//   /conversations Conversaciones /finance    Finanzas     /pipeline  Pipeline
//   /offers      Ofertas          /users      Usuarios     /settings  Ajustes
//
// EL NEGOCIO SEMILLA
// -------------------
// `SEED_BUSINESS_ID` (en `.env.test`) es el `business_id` de un tenant de
// prueba aislado — nunca un negocio real. La app deriva el tenant del
// `staff_users.business_id` del usuario logueado (no hace falta pasar
// `?bid=` en la URL: ver `src/hooks/useAuth.js`). CUALQUIER test que liste
// datos (pacientes, turnos, ingresos...) autenticado con estas fixtures va a
// ver SOLO datos de `SEED_BUSINESS_ID` — si ves datos de otro negocio, eso
// ES el bug de aislamiento cross-tenant que COD-7 tiene que cazar.
//
// SI ESTE ARCHIVO FALLA AL IMPORTAR / LOS TESTS TIMEOUTEAN EN EL LOGIN
// ----------------------------------------------------------------------
// Revisá `tests/setup/global-setup.js` — corre antes que vos y explica en su
// propio error qué variable de `.env.test` falta. No agregues tu propio
// login: si algo no funciona acá, es un problema del harness, repórtalo.
// ═══════════════════════════════════════════════════════════════════════════

import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../playwright/.auth');

export const OWNER_STATE = path.join(AUTH_DIR, 'owner.json');
export const SECRETARY_STATE = path.join(AUTH_DIR, 'secretary.json');

/** @type {import('@playwright/test').Test} */
export const test = base.extend({
    // Página autenticada como owner, con el viewport del proyecto actual.
    ownerPage: async ({ browser }, use, testInfo) => {
        const context = await browser.newContext({
            storageState: OWNER_STATE,
            ...testInfo.project.use,
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },
    // Página autenticada como secretary, con el viewport del proyecto actual.
    secretaryPage: async ({ browser }, use, testInfo) => {
        const context = await browser.newContext({
            storageState: SECRETARY_STATE,
            ...testInfo.project.use,
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
    },
});

export { expect };

// Los 9 módulos autenticados — fuente única para recorridos T29/COD-7, así
// ningún agente hardcodea la lista de rutas por su cuenta y se desincroniza
// de src/App.jsx.
export const AUTHENTICATED_MODULES = [
    { name: 'Calendario', path: '/' },
    { name: 'Pacientes', path: '/patients' },
    { name: 'Seguimiento', path: '/followup' },
    { name: 'Conversaciones', path: '/conversations' },
    { name: 'Finanzas', path: '/finance' },
    { name: 'Pipeline', path: '/pipeline' },
    { name: 'Ofertas', path: '/offers' },
    { name: 'Usuarios', path: '/users' },
    { name: 'Ajustes', path: '/settings' },
];
