# Workflow n8n — Auditoría, Fixes y Roadmap de Agente IA

> **Fecha:** 2026-07-06 · Fuente auditada: `NovTurnAI (20).json` (5,844 líneas) cruzado contra el esquema real de Supabase (`kwpaaqdkklwwfslhkqpb`).
> Estructura: **Parte 1** hallazgos y fixes (lo aplicado + lo que debes tocar en n8n) · **Parte 2** memoria del agente con bajo consumo de tokens (implementado el lado DB) · **Parte 3** roadmap "Módulo IA del sistema" (solo planificación).
> Convención: ✅ = ya aplicado por mí en la DB · ✏️ = lo aplica el usuario en la UI de n8n (paso a paso abajo).

---

## Resumen de la verificación

Lo que sigue **correcto** tras los cambios recientes en la DB:
- Todas las tablas/columnas que toca el workflow existen: `patient_phones(is_primary)`, `message_buffer(message_id, expires_at)`, `notifications(type, title, message, appointment_id)`, `history(role, content)`, `appointments(cancelled_at, is_rescheduled)`. ✓
- Firmas de RPC de los tools coinciden con la DB: `get_available_slots(uuid,date,int)`, `create_appointment(uuid,uuid,text,text,text)`, `get_patient_appointments(uuid,uuid)`. ✓
- **Efecto colateral positivo**: al dropear el overload viejo `get_available_slots(integer,date)`, desapareció la ambigüedad de sobrecarga → el tool resuelve limpio.

Lo que se **rompió o quedó flojo** por los cambios recientes → Parte 1.

---

## PARTE 1 — Hallazgos y fixes

| # | Severidad | Qué | Dónde | Estado |
|---|---|---|---|---|
| 1 | 🔴 CRÍTICO | `check_rate_limit` con key `anon` (revocada) → nodo falla en cada mensaje | Nodo `DB - Request API Limit` | ✏️ n8n |
| 2 | 🔴 CRÍTICO | Triggers de límite rompían al bot (paciente #51 / turno) | DB (`enforce_*_limit`) | ✅ Corregido |
| 3 | 🟠 MEDIO | RPCs de agenda ejecutables por `anon` (key pública) | DB (grants) | ✅ Corregido |
| 4 | 🟠 MEDIO | `record_usage` nunca se llama → metering muerto, `ai_paused` no corta | Workflow completo | ✏️ n8n (decisión) |
| 5 | 🟡 BAJO | Conteo de "conversaciones" cuenta filas de history (user+assistant) | Nodo `Conversaciones - Contar` | ✏️ opcional |
| 6 | 🟡 BAJO | Gate de turnos usa `created_at`, el trigger usa `date_start` | Nodo `Turnos - Scheduled/Confirmed` | ✏️ opcional |
| 7 | 🟡 BAJO | El bot ignora `limit_overrides` (lee plan crudo) | Nodo `Plan - Obtener` | ✏️ opcional |

### 🔴 #1 — Rate-limit roto (bot caído en cada mensaje) — ✏️ n8n
**Causa:** en una sesión previa se revocó `EXECUTE` a `anon`/`public` sobre `check_rate_limit` (correcto por seguridad). El nodo `DB - Request API Limit` sigue enviando la **anon key** → PostgREST responde 401/403; el nodo no tiene `onError` → corta el flujo **antes de responder al cliente**. Como `businesses`=0 hoy, no hay tráfico vivo, pero rompería a todos los tenants al onboardear.

**Fix:** en el nodo `DB - Request API Limit`, en `jsonHeaders`, reemplazar **ambos** valores (`apikey` y `Authorization: Bearer`) de la anon key por la **service_role key** — la misma que ya usan todos los tools (busca en cualquier `Tool - ...` el JWT que contiene `"role":"service_role"`). Cero cambios de lógica. Verificación: el nodo debe devolver un entero (el contador), no 401.

> Nota: la service_role key ya está hardcodeada por diseño (decisión del usuario) en el resto de nodos; este cambio solo alinea el nodo de rate-limit con esa misma práctica.

### 🔴 #2 — Triggers de límite rompían al bot — ✅ Corregido
Los triggers `enforce_patient_limit`/`enforce_staff_limit`/`enforce_appointment_limit` (creados al implementar los límites de plan) aplicaban a **todos**, incluido el bot (service_role). Con Básico=50 pacientes, el bot no podría crear el paciente #51 y **la conversación de WhatsApp se caería** (los nodos `Paciente - Crear` no tienen `onError`).

**Decisión del usuario:** los límites son de **visualización**, no cárcel del bot. **Aplicado** (migración `limits_visualization_only_and_profile_and_revokes`): cada trigger ahora empieza con
```sql
IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- bot/service_role: sin cap duro
```
Resultado: el **dashboard** (authenticated) sigue bloqueado en el límite; el **bot** nunca se rompe. El negocio "ve" 50 pacientes (lo recorta `get_visible_patient_ids`) mientras el bot atiende a todos. Para turnos/conversaciones, el bot ya tiene sus gates amables aguas arriba (`Flow - ¿Superó límite?`, `Flow - ¿Conversaciones Ok?`).
**Verificado** con probe de rollback: bot crea paciente #51 en Básico ✓; dashboard sigue bloqueado ✓.

### 🟠 #3 — RPCs de agenda ejecutables por anon — ✅ Corregido
`create_appointment`, `get_available_slots`, `get_patient_appointments` tenían `EXECUTE` para `anon`/`public`. Como la **anon key es pública** (va en el frontend), cualquiera podía crear turnos o leer citas de cualquier `business_id`/`patient_id`. Los tools del bot usan **service_role**, así que revocar no los rompe.
**Aplicado:** `REVOKE EXECUTE ... FROM PUBLIC, anon` en las tres. **Verificado**: las 4 RPCs (incl. `get_patient_profile`) quedan `anon=false, public=false, service_role=true`.

### 🟠 #4 — `record_usage` nunca se llama (metering muerto) — ✏️ decisión
No hay una sola llamada a `record_usage` en el workflow → `usage_counters` no incrementa: el **panel admin muestra 0** tokens/mensajes, y el **corte automático `ai_paused`** (documentado como la red de seguridad del margen en el modelo de negocio) **nunca dispara**. El bot cuenta por su cuenta con `Conversaciones - Contar` (filas de `history` del mes vs `max_conversations`) — funciona como gate, pero deja el metering y el corte por tokens sin datos.

**Fix recomendado (✏️ n8n):** tras cada respuesta del agente (junto a `Historial - Respuesta ...`), añadir un nodo HTTP `POST https://kwpaaqdkklwwfslhkqpb.supabase.co/rest/v1/rpc/record_usage` con headers service_role y body:
```json
{ "p_business_id": "={{ $('Negocio - Obtener').first().json.id }}", "p_messages": 1, "p_tokens_in": 0, "p_tokens_out": 0 }
```
Los tokens exactos de Gemini se pueden mapear desde la respuesta del nodo Agente si se desea (campo `tokenUsage` del LLM); si no, con `p_messages:1` ya alimentas el panel y el corte por mensajes. `record_usage` ya pausa (`ai_paused=true`) al llegar al límite del plan. **Alternativa:** si prefieres seguir con el gate por `history`, deja `record_usage` sin cablear y actualiza el modelo de negocio para no depender de `ai_paused` (hoy el doc 01 asume que sí corta).

### 🟡 Menores (✏️ opcional)
- **#5 Conteo de conversaciones**: `Conversaciones - Contar` cuenta filas de `history` (user **y** assistant ≈ 2 por intercambio) contra `max_conversations` → el límite efectivo es ~la mitad del configurado. Si quieres que "5,000 mensajes" = 5,000 mensajes del cliente, filtra `role = 'user'` en ese getAll.
- **#6 Ventana del gate de turnos**: `Turnos - Scheduled/Confirmed` filtran por `created_at >= inicio de mes` (cuándo se creó la fila); el trigger de la DB cuenta por `date_start` (cuándo es el turno). Alinea ambos a `date_start` para que "turnos del mes" signifique lo mismo en bot y dashboard.
- **#7 `limit_overrides` ignorado por el bot**: el bot lee `Plan - Obtener` (tabla `plans` cruda), así que un `limit_overrides` de un negocio (que el dashboard sí respeta vía `get_effective_limit`) no lo ve el bot. Bajo impacto; si algún Enterprise tiene override, considéralo.

---

## PARTE 2 — Memoria del agente con consumo mínimo de tokens

**Restricción del usuario (crítica):** en los HTTP request se pasan **solo columnas puntuales**, nunca tablas enteras, para no inflar input tokens. La memoria respeta eso.

### Por qué NO memoria semántica (pgvector) ahora
La memoria "libre" (preferencias en lenguaje natural con embeddings) suena ideal pero cuesta tokens en dos frentes: (a) una **llamada LLM destiladora por conversación** para extraer los hechos (lo caro), y (b) **~150 tokens de input añadidos a cada mensaje** al inyectar los recuerdos. Estimado: sobre 1,000 conversaciones/mes, la sola destilación ≈ **duplica** el costo IA de esas conversaciones. → **Diferido**; diseño guardado abajo (§2.3) para retomar cuando el volumen lo justifique.

### 2.1 Perfil de paciente determinista (0 tokens de escritura) — ✅ implementado (DB)
Reutiliza datos que YA existen (`appointments`, `services`) por SQL, sin ninguna llamada LLM. Cubre tu visión de "priorizar pacientes frecuentes y ofrecerles cosas". **Aplicado** `get_patient_profile(business_id, patient_id)` (SECURITY DEFINER, solo service_role):
```json
// ejemplo de salida (compacto → ~40-60 tokens):
{ "visitas": 2, "no_shows": 0, "servicio_frecuente": "Corte", "ultima_visita": "2026-06-15T16:00:00+00:00", "prioridad": "media" }
```
`prioridad`: `alta` (≥5 visitas), `media` (≥2), `nueva`. Usa el índice existente `idx_appt_patient`. **Verificado** con probe.

### 2.2 Cómo cablearlo en n8n (✏️, solo Enterprise)
1. **Nuevo tool** `Tool - Perfil Paciente Enterprise` (httpRequestTool), agregado SOLO al `Agente - Enterprise`:
   - `GET https://kwpaaqdkklwwfslhkqpb.supabase.co/rest/v1/rpc/get_patient_profile?p_business_id={{ $('Negocio - Obtener').first().json.id }}&p_patient_id={{ $if($('Paciente - Obtener Datos').isExecuted, $('Paciente - Obtener Datos').first().json.id, $('Paciente - Crear').first().json.id) }}`
   - Headers service_role (igual que los demás tools). `toolDescription`: "Perfil del cliente recurrente: visitas, servicio frecuente, última visita, prioridad. Llamar SOLO si el cliente ya es conocido, para personalizar."
2. **Regla anti-tokens** (en el systemMessage del Agente Enterprise): "Llama `GetPerfil` **solo** si el cliente NO es nuevo. Si es nuevo, NO lo llames." Así un cliente nuevo gasta 0 tokens de perfil.
3. **Uso**: el agente personaliza ("veo que sueles venir por {servicio_frecuente}") y prioriza/ofrece a `prioridad='alta'`. Máximo 1 llamada por conversación.

### 2.3 Memoria semántica pgvector — DIFERIDA (diseño para el futuro)
Cuando el volumen y el precio Enterprise lo justifiquen:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE patient_memories ( id uuid PK default gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  content text, embedding vector(768), created_at timestamptz default now() );
CREATE INDEX ON patient_memories USING hnsw (embedding vector_cosine_ops);
-- RPC match_patient_memories(business_id, patient_id, query_embedding, k) → top-k por <=>
```
n8n: (escritor) tras la conversación, un LLM destila 0-3 hechos → embedding (`text-embedding-004`) → insert; (lector) tool que embebe la consulta y trae top-k. **Costo**: 1 LLM extra/conversación + ~150 tokens/mensaje. Revisar cuando aplique.

---

## PARTE 3 — Módulo IA del sistema (ROADMAP FUTURO — solo planificación, NO se implementa)

Visión: sacar la IA del chat de WhatsApp y dársela al **sistema** (dashboard). El dueño pide bajo demanda resúmenes/análisis/estrategias sobre SUS datos. Son **workflows/módulos separados** del bot. Gate a Enterprise (flags `stats_intelligence`, `content_gen` ya existen).

### 3.1 Principio de tokens: pull, no push
A diferencia del bot (gasta en CADA mensaje), estos módulos gastan **solo cuando el dueño lo pide** o en un **batch acotado** (1×/semana), y el resultado se **cachea** → verlo cuesta 0 tokens. Es el uso de IA de mejor margen.

Tabla base (futura): `ai_insights(id, business_id, scope, ref_id, content jsonb, generated_at)`, `scope` ∈ {patient_summary, patient_strategy, weekly_digest, retention, kpi_narrative}. RLS por `business_id`. La UI lee de aquí; la IA solo escribe al generar.

### 3.2 Workflows/features a construir (cada uno = 1 flujo n8n o Edge Function)
1. **Resumen de seguimiento por paciente** (on-demand). Botón "Resumen IA" en la ficha → Edge Function `ai-insights` → contexto compacto (`get_patient_profile` + últimos N mensajes resumidos, solo columnas puntuales) → Gemini → `ai_insights(patient_summary)`.
2. **Estrategia por cliente** (on-demand/batch). Según `prioridad`: reactivar inactivos, upsell a frecuentes, recuperar quejosos. Devuelve acción + borrador de WhatsApp para que el dueño **apruebe** (no se envía solo).
3. **Análisis de seguimiento / retención** (batch semanal). `scheduleTrigger` → por negocio Enterprise → SQL detecta pacientes en riesgo (sin visita en X días, no-shows) → Gemini prioriza a quién contactar → `ai_insights(retention)` + notificación.
4. **Estadísticas inteligentes / narrativa de KPIs** (batch/on-demand). Toma KPIs ya agregados de las RPCs existentes (`get_stats_dashboard`, `get_finance_summary`, `get_retention_rate`) → Gemini redacta el "por qué" y recomendaciones. `ai_insights(kpi_narrative)`.
5. **Digest semanal del negocio** (batch). Resumen ejecutivo (ingresos, turnos, no-shows, top servicios, 3 recomendaciones) → `ai_insights(weekly_digest)` + email (ver doc 04) o notificación.
6. **Generación de contenido/ofertas** (on-demand). Sugerir promos para días flojos + redactar copy; conecta con el módulo de Ofertas.
7. **(Enterprise premium) Chat de negocio en el dashboard**. Pregunta libre ("¿a quién contacto esta semana?") → Edge Function con RAG sobre `ai_insights` + SQL puntual. Tokens solo por pregunta.

### 3.3 Arquitectura común (sin inflar tokens)
- **Contexto compacto siempre**: solo agregados/columnas puntuales (mismo principio del bot), nunca tablas completas. Las RPCs de stats ya devuelven agregados.
- **Cache-first**: la UI del "módulo IA" lee `ai_insights`; el botón "Regenerar" es lo único que gasta tokens.
- **Disparo**: on-demand (Edge Function desde el dashboard) para lo interactivo; `scheduleTrigger` n8n o pg_cron→Edge Function para batches. Reúsa `get_patient_profile` como bloque de contexto barato.
- **Modelo**: Gemini 2.5 Flash-Lite para resúmenes cortos (barato); Flash solo para narrativa/estrategia.

### 3.4 Costo estimado
On-demand: ~1 llamada corta (Flash-Lite ≈ fracciones de centavo) por clic. Batch semanal: ~1-2 llamadas/negocio/semana. A 20 Enterprise ≈ decenas/semana → trivial frente a Q3,999. Es el uso de IA de mejor margen del sistema.

---

## Migraciones DB aplicadas hoy (verificadas)
| Migración | Contenido | Verificación |
|---|---|---|
| `limits_visualization_only_and_profile_and_revokes` | Eximir service_role en los 3 triggers `enforce_*_limit`; revocar anon/public en `create_appointment`/`get_available_slots`/`get_patient_appointments`; crear `get_patient_profile` | Probe: bot crea paciente #51 ✓; perfil OK ✓; 4 RPCs anon=false/service=true ✓ |

## Checklist para el otro agente (implementación)
1. ✏️ n8n · #1: cambiar key anon → service_role en `DB - Request API Limit`. **(bloqueante para producción)**
2. ✏️ n8n · Parte 2.2: agregar `Tool - Perfil Paciente Enterprise` al Agente Enterprise + regla en el prompt.
3. ✏️ n8n · #4 (decisión): cablear `record_usage` o actualizar doc 01.
4. ✏️ n8n · menores #5/#6/#7 según se quiera.
5. Futuro: Parte 3 (módulo IA) y §2.3 (pgvector) cuando el usuario lo priorice.
