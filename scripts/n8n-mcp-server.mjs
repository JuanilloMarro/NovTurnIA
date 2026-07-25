#!/usr/bin/env node
// Puente MCP (stdio) → webhook de n8n.
// La URL del túnel Cloudflare rota por sesión: se actualiza en .mcp.json (env N8N_WEBHOOK_URL).

const BASE = process.env.N8N_WEBHOOK_URL;
const TIMEOUT_MS = 90000;

const TOOLS = [
    {
        name: 'n8n_get',
        description: 'Llama el webhook de entrada de n8n con GET. Los parámetros se envían como query string.',
        inputSchema: {
            type: 'object',
            properties: {
                params: {
                    type: 'object',
                    description: 'Parámetros query opcionales (clave → valor)',
                    additionalProperties: true,
                },
            },
        },
    },
    {
        name: 'n8n_post',
        description: 'Llama el webhook de entrada de n8n con POST enviando un body JSON.',
        inputSchema: {
            type: 'object',
            properties: {
                body: {
                    type: 'object',
                    description: 'Body JSON a enviar al workflow',
                    additionalProperties: true,
                },
            },
        },
    },
];

async function callTool(name, args) {
    if (!BASE) throw new Error('N8N_WEBHOOK_URL no está definida en el entorno');
    let res;
    if (name === 'n8n_get') {
        const url = new URL(BASE);
        for (const [k, v] of Object.entries(args?.params || {})) {
            url.searchParams.set(k, String(v));
        }
        res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } else if (name === 'n8n_post') {
        res = await fetch(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args?.body ?? {}),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } else {
        throw new Error(`Tool desconocida: ${name}`);
    }
    const text = await res.text();
    return `HTTP ${res.status}\n${text}`;
}

function send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(line) {
    let msg;
    try {
        msg = JSON.parse(line);
    } catch {
        return;
    }
    const { id, method, params } = msg;

    if (method === 'initialize') {
        send({
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: params?.protocolVersion || '2025-03-26',
                capabilities: { tools: {} },
                serverInfo: { name: 'n8n-webhook-bridge', version: '1.0.0' },
            },
        });
    } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
        // sin respuesta
    } else if (method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
    } else if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
        pending++;
        try {
            const text = await callTool(params?.name, params?.arguments);
            send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
        } catch (e) {
            send({
                jsonrpc: '2.0',
                id,
                result: { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true },
            });
        } finally {
            pending--;
            maybeExit();
        }
    } else if (id !== undefined) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
}

let buf = '';
let pending = 0;
let stdinClosed = false;

function maybeExit() {
    if (stdinClosed && pending === 0) process.exit(0);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) handle(line);
    }
});
process.stdin.on('end', () => {
    stdinClosed = true;
    maybeExit();
});
