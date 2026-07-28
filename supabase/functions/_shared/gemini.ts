// supabase/functions/_shared/gemini.ts
// Cliente mínimo para Gemini (generateContent) — usado por ai-insights y ai-chat.
// Modelo por tarea + modelName/maxOutputTokens siempre explícitos (lección del
// hallazgo #4/#9 de la auditoría del bot: nunca dejar el default del proveedor).
//
// Bug 2026-07-14: los modelos 2.5 "piensan" por defecto y ese razonamiento
// interno consume maxOutputTokens. Con budgets de 300-400, gemini-2.5-flash
// gastaba casi todo en pensar y la respuesta visible salía truncada a 3-8
// tokens ('{"promos', "Here is the JSON requested:") — y el catch de
// callGeminiJSON cacheaba { raw: ... } en ai_insights. De ahí las tres reglas
// de este cliente: thinking apagado, finishReason verificado, y NUNCA devolver
// { raw } — si no hay JSON válido se lanza error para que el caller no cachee.

import { fetchUpstream } from './fetchUpstream.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// Timeout y reintento del fetch a Gemini (EDGE-1/EDGE-2). El razonamiento está
// apagado (thinkingBudget:0) y los budgets son chicos (300-400 tokens), así que
// una generación sana responde rápido; 20s por intento es techo de "colgado",
// no de latencia normal. tries=2 = un reintento ante 5xx/429/red transitorio.
// Es ORTOGONAL al reintento por schema de callGeminiJSON: ese reintenta cuando
// el JSON no calza; este, cuando el fetch HTTP mismo falla de forma transitoria.
const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_TRIES = 2;

// Tarifas de Gemini en $/M tokens (== micro-USD por token, mismo número).
// Usadas para registrar el costo real de cada request en ai_usage_weekly
// (telemetría de margen del dueño). Revisar el rate card si cambia el modelo.
export const GEMINI_RATES: Record<string, { in: number; out: number }> = {
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
};

export function costMicroUsd(model: string, tokensIn: number, tokensOut: number): number {
  // Modelo desconocido: cobrar como el más caro para no subestimar jamás.
  const rate = GEMINI_RATES[model] ?? GEMINI_RATES['gemini-2.5-flash'];
  return Math.round(tokensIn * rate.in + tokensOut * rate.out);
}

// Error de una llamada a Gemini que igual consumió tokens que Google ya cobró.
// SEC-4/T2: callGeminiJSON reintenta acumulando tokens; si al final lanza, esos
// tokens deben registrarse de todas formas. El error los transporta para que el
// caller los descuente del presupuesto semanal en la ruta de fallo, en vez de
// que un fallo repetible permita gastar sin que el contador se mueva.
export class GeminiError extends Error {
  readonly tokensIn: number;
  readonly tokensOut: number;
  constructor(message: string, tokensIn = 0, tokensOut = 0) {
    super(message);
    this.name = 'GeminiError';
    this.tokensIn = tokensIn;
    this.tokensOut = tokensOut;
  }
}

async function callGeminiRaw(model: string, promptText: string, generationConfig: Record<string, unknown>) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está configurado en los secrets del proyecto.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  // fetchUpstream: timeout duro + reintento en transitorios. Un 5xx/429/red se
  // reintenta acá; si igual falla, devuelve la respuesta final y el `!res.ok`
  // de abajo lanza como siempre. Un fallo transitorio no gasta tokens (Google
  // no factura un request fallido), así que reintentar no descuadra el budget.
  const res = await fetchUpstream(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        // thinkingBudget: 0 apaga el razonamiento en flash y flash-lite; sin
        // esto, pensar consume el budget de salida (ver header). El caller
        // puede sobreescribirlo pasando su propio thinkingConfig.
        thinkingConfig: { thinkingBudget: 0 },
        ...generationConfig,
      },
    }),
    timeoutMs: GEMINI_TIMEOUT_MS,
    tries: GEMINI_TRIES,
    label: `gemini:${model}`,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini (${model}) respondió ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const usage = data.usageMetadata ?? {};
  const candidate = data.candidates?.[0];
  // Puede venir más de un part (y parts de razonamiento con thought:true si
  // algún día se habilita includeThoughts) — unir solo la respuesta real.
  const text = (candidate?.content?.parts ?? [])
    .filter((p: { thought?: boolean; text?: unknown }) => p?.thought !== true && typeof p?.text === 'string')
    .map((p: { text: string }) => p.text)
    .join('');
  // thoughtsTokenCount se factura como salida: sumarlo o record_usage subcontaría.
  const tokensOut = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return {
    text,
    tokensIn: usage.promptTokenCount ?? 0,
    tokensOut,
    finishReason: candidate?.finishReason ?? 'UNKNOWN',
  };
}

// Extrae el primer JSON parseable de la salida de un modelo: parse directo →
// bloque ```json``` → substring del primer {/[ al último }/]. null si nada parsea.
export function extractJSON(text: string): unknown {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const candidates: string[] = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = raw.indexOf(open);
    const end = raw.lastIndexOf(close);
    if (start !== -1 && end > start) candidates.push(raw.slice(start, end + 1));
  }
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* siguiente candidato */ }
  }
  return null;
}

// ¿El JSON parseado trae las claves top-level `required` del schema? Detecta
// truncamientos que igual parsean (p. ej. un fragmento interno rescatado).
function matchesRequired(content: unknown, responseSchema: object): boolean {
  if (content === null || content === undefined) return false;
  const required = (responseSchema as { required?: unknown }).required;
  if (!Array.isArray(required) || required.length === 0) return true;
  if (typeof content !== 'object' || Array.isArray(content)) return false;
  return required.every((k) => (content as Record<string, unknown>)[k as string] !== undefined);
}

// Salida estructurada (responseSchema) — usado por ai-insights y el router de
// ai-chat. Si el modelo trunca (MAX_TOKENS) o el JSON no calza con el schema,
// reintenta UNA vez con el doble de budget; si aun así falla LANZA error.
// Jamás devuelve { raw: ... }: el caller no debe cachear salidas rotas.
export async function callGeminiJSON(model: string, promptText: string, responseSchema: object, maxOutputTokens: number) {
  let tokensInTotal = 0;
  let tokensOutTotal = 0;
  let lastFinish = 'UNKNOWN';

  // Todo lo que pueda lanzar (HTTP 4xx/5xx de callGeminiRaw, o el throw de
  // schema no cumplido) se envuelve en un GeminiError que arrastra los tokens
  // acumulados hasta el momento del fallo. Sin esto, un 503 en el 2º intento
  // descartaba los tokens del 1º y el presupuesto no se movía (SEC-4/T2).
  try {
    for (const budget of [maxOutputTokens, maxOutputTokens * 2]) {
      const { text, tokensIn, tokensOut, finishReason } = await callGeminiRaw(model, promptText, {
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: budget,
        temperature: 0.4,
      });
      tokensInTotal += tokensIn;
      tokensOutTotal += tokensOut;
      lastFinish = finishReason;

      const content = extractJSON(text);
      if (matchesRequired(content, responseSchema)) {
        return { content, tokensIn: tokensInTotal, tokensOut: tokensOutTotal };
      }
    }
    throw new Error(`Gemini (${model}) no devolvió el JSON del schema (finishReason: ${lastFinish}).`);
  } catch (err) {
    if (err instanceof GeminiError) throw err; // ya trae tokens (no debería anidarse)
    const message = err instanceof Error ? err.message : String(err);
    throw new GeminiError(message, tokensInTotal, tokensOutTotal);
  }
}

// Texto libre — usado por la respuesta final del chat de negocio. Una sola
// llamada, sin reintento: si falla por HTTP, Google no devolvió usageMetadata,
// así que los tokens de este intento son 0. Igual se lanza como GeminiError para
// que el caller trate todas las rutas de fallo de Gemini de forma uniforme.
export async function callGeminiText(model: string, promptText: string, maxOutputTokens: number) {
  try {
    const { text, tokensIn, tokensOut } = await callGeminiRaw(model, promptText, { maxOutputTokens, temperature: 0.5 });
    return { text, tokensIn, tokensOut };
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new GeminiError(message, 0, 0);
  }
}
