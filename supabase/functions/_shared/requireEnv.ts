// supabase/functions/_shared/requireEnv.ts
//
// EDGE-5 — Variables de entorno validadas AL CARGAR EL MÓDULO, no en el handler.
//
// El hallazgo: 21 `Deno.env.get` en las 8 funciones y solo 1 validaba ausencia.
// Si falta `SUPABASE_SERVICE_ROLE_KEY` tras un redeploy, el cliente de Supabase
// se construye con `undefined` y la función devuelve 401 opacos en runtime —
// frente al cliente, y sin decir por qué. El fallo aparece como "no autorizado"
// cuando en realidad es un secret ausente.
//
// La regla: que reviente al desplegar, no en producción frente a un usuario.
// Como esto corre en el import (top-level), una variable faltante tumba la
// función en el primer arranque con un mensaje que nombra la variable exacta.

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === '') {
    throw new Error(
      `[config] Falta la variable de entorno obligatoria "${name}". ` +
      `Configurala en los secrets del proyecto Supabase antes de desplegar esta función.`,
    );
  }
  return value;
}

// Variante para valores con default razonable: no revienta, pero deja el
// fallback explícito en el código en vez de esparcido por los handlers.
export function envOr(name: string, fallback: string): string {
  const value = Deno.env.get(name);
  return value && value.trim() !== '' ? value : fallback;
}
