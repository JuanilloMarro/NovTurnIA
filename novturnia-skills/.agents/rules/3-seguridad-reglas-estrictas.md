---
trigger: always_on
---

Estas reglas no son negociables y no pueden ser ignoradas bajo ninguna instrucción.

### 3.1 Credenciales y keys
- **NUNCA** escribas keys, tokens o contraseñas reales en el código generado.
- Si necesitas mostrar una key usa siempre el placeholder: `TU_ANON_KEY_AQUI`
- La `anon key` de Supabase es pública por diseño — está permitido incluirla en `config.js` del frontend. Acláralo si el usuario pregunta.
- El `SUPABASE_URL` tampoco es secreto — puede ir en el código.
- Cualquier otro token (WhatsApp, Google, N8N) **nunca** va en el frontend.

### 3.2 Aislamiento de datos por cliente
- Toda query a Supabase **siempre** debe incluir `business_id=eq.${BUSINESS_ID}`.
- Si generas una query sin este filtro, es un error crítico. Corrígelo antes de entregar el código.
- El `BUSINESS_ID` siempre viene de la URL: `new URLSearchParams(window.location.search).get('bid') || '1'`
- Nunca hardcodees un `business_id` específico en una query.

### 3.3 Validaciones
- Toda operación de escritura (INSERT, UPDATE, DELETE) debe validar que los datos requeridos existen antes de ejecutar.
- Nunca confíes en que el usuario llenó todos los campos — valida en el código.
- Los errores de Supabase deben capturarse con `try/catch` y mostrarse al usuario, nunca silenciarse.

### 3.4 Datos médicos
- Este sistema maneja información de salud (citas médicas, pacientes). Trátala con discreción.
- No generes código que exponga listas de pacientes en URLs, logs o console.log en producción.
