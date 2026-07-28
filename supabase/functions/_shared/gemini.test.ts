// supabase/functions/_shared/gemini.test.ts
// SEC-4 / T2 — callGeminiJSON debe arrastrar en el error los tokens que Google
// ya cobró en CADA intento (éxito parcial + reintento), para que el caller los
// descuente del presupuesto en la ruta de fallo. Sin el fix, esos tokens se
// perdían y un fallo repetible permitía gastar sin mover el contador semanal.
//
// Correr:
//   GEMINI_API_KEY=test-key deno test --allow-env supabase/functions/_shared/gemini.test.ts

import { assert, assertEquals, assertInstanceOf } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { callGeminiJSON, callGeminiText, GeminiError } from './gemini.ts';

const SCHEMA = { type: 'OBJECT', properties: { foo: { type: 'STRING' } }, required: ['foo'] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Cuerpo mínimo de generateContent con usageMetadata y un candidate de texto.
function geminiResult(text: string, tokensIn: number, tokensOut: number) {
  return {
    usageMetadata: { promptTokenCount: tokensIn, candidatesTokenCount: tokensOut },
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  };
}

// Instala una secuencia de respuestas para globalThis.fetch (sin red real).
// Devuelve restore() y un contador de invocaciones a fetch.
function stubFetch(makeResponses: Array<() => Response>) {
  const original = globalThis.fetch;
  const state = { calls: 0 };
  let i = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    const make = makeResponses[Math.min(i, makeResponses.length - 1)];
    i++;
    state.calls++;
    return Promise.resolve(make());
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, state };
}

Deno.test('callGeminiJSON: happy path devuelve content y tokens', async () => {
  const { restore } = stubFetch([() => jsonResponse(geminiResult('{"foo":"ok"}', 100, 20))]);
  try {
    const out = await callGeminiJSON('gemini-2.5-flash-lite', 'p', SCHEMA, 60);
    assertEquals(out.content, { foo: 'ok' });
    assertEquals(out.tokensIn, 100);
    assertEquals(out.tokensOut, 20);
  } finally {
    restore();
  }
});

Deno.test('SEC-4: dos intentos con schema no cumplido → GeminiError con tokens ACUMULADOS de ambos', async () => {
  // Ambas respuestas son 200 pero el JSON no trae la clave required 'foo':
  // el schema nunca calza, se agota el reintento y se lanza.
  const { restore, state } = stubFetch([
    () => jsonResponse(geminiResult('{"bar":1}', 100, 20)),
    () => jsonResponse(geminiResult('{"bar":2}', 130, 25)),
  ]);
  try {
    let err: unknown;
    try {
      await callGeminiJSON('gemini-2.5-flash', 'p', SCHEMA, 60);
    } catch (e) {
      err = e;
    }
    assertInstanceOf(err, GeminiError);
    assertEquals(state.calls, 2, 'debe reintentar exactamente una vez');
    assertEquals((err as GeminiError).tokensIn, 230); // 100 + 130
    assertEquals((err as GeminiError).tokensOut, 45); // 20 + 25
  } finally {
    restore();
  }
});

Deno.test('SEC-4: 2º intento con HTTP 503 → GeminiError conserva los tokens del 1º intento', async () => {
  const { restore, state } = stubFetch([
    () => jsonResponse(geminiResult('{"bar":1}', 100, 20)), // 1º: 200, schema no cumple, cobra tokens
    () => new Response('model overloaded', { status: 503 }), // 2º: 503, sin usageMetadata
  ]);
  try {
    let err: unknown;
    try {
      await callGeminiJSON('gemini-2.5-flash', 'p', SCHEMA, 60);
    } catch (e) {
      err = e;
    }
    assertInstanceOf(err, GeminiError);
    assertEquals(state.calls, 2);
    assertEquals((err as GeminiError).tokensIn, 100); // solo el 1º; el 2º falló sin devolver tokens
    assertEquals((err as GeminiError).tokensOut, 20);
    assert((err as GeminiError).message.includes('503'), 'el mensaje debe conservar el status HTTP del upstream');
  } finally {
    restore();
  }
});

Deno.test('SEC-4: callGeminiText lanza GeminiError (tokens 0) ante HTTP de error', async () => {
  const { restore } = stubFetch([() => new Response('boom', { status: 500 })]);
  try {
    let err: unknown;
    try {
      await callGeminiText('gemini-2.5-flash', 'p', 400);
    } catch (e) {
      err = e;
    }
    assertInstanceOf(err, GeminiError);
    assertEquals((err as GeminiError).tokensIn, 0);
    assertEquals((err as GeminiError).tokensOut, 0);
  } finally {
    restore();
  }
});
