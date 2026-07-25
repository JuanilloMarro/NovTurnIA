#!/usr/bin/env node
// Helper CLI para la API REST de n8n. Lee N8N_BASE_URL y N8N_API_KEY del .env del proyecto.
// Uso: node scripts/n8n-api.mjs GET /workflows
//      node scripts/n8n-api.mjs GET "/executions?limit=5"
//      node scripts/n8n-api.mjs PUT /workflows/<id> payload.json

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
}

const BASE = env.N8N_BASE_URL;
const KEY = env.N8N_API_KEY;
if (!BASE || !KEY) {
    console.error('Faltan N8N_BASE_URL / N8N_API_KEY en .env');
    process.exit(1);
}

const [method, path, bodyFile] = process.argv.slice(2);
if (!method || !path) {
    console.error('Uso: n8n-api.mjs <GET|POST|PUT|PATCH|DELETE> </ruta> [body.json]');
    process.exit(1);
}

const opts = {
    method: method.toUpperCase(),
    headers: { 'X-N8N-API-KEY': KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
};
if (bodyFile) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = readFileSync(bodyFile, 'utf8');
}

const res = await fetch(`${BASE}/api/v1${path}`, opts);
const text = await res.text();
console.error(`HTTP ${res.status}`);
console.log(text);
