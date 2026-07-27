# Infraestructura Supabase — Auditoría

> Estado real del proyecto `kwpaaqdkklwwfslhkqpb`, verificado por MCP contra la base de producción: `pg_catalog`, `pg_policy`, `pg_proc`, `cron.job`, `cron.job_run_details`, advisors de seguridad y rendimiento, `supabase_migrations`, `storage`, `auth`.
> PostgreSQL **17.6**.

---

## 1. Resumen

| Área | Estado |
|---|---|
| Seguridad RLS | ✅ 34 tablas con RLS, 107 políticas, **0 errores** en el advisor |
| Higiene de funciones | ✅ 97 funciones, **0 SECURITY DEFINER sin `search_path`** |
| Superficie `anon` | ⚠️ 6 funciones ejecutables sin autenticar (§4.2) |
| Automatización | ✅ 12 crons, 20,234 ejecuciones/14 días, **1 fallo transitorio** |
| Edge Functions | ✅ 8 activas, todas con `verify_jwt` |
| Rendimiento | ⚠️ 14 políticas sin optimizar, todas en módulos nuevos (§5.1) |
| Auditoría de cambios | ⚠️ Cobertura incompleta: `services` y `offers` sin trigger (§5.3) |
| **Reproducibilidad** | 🔴 **127 migraciones en producción, 27 archivos en el repositorio** (§4.1) |

**Inventario:** 34 tablas + 8 particiones · 2 vistas · 97 funciones · 52 triggers · 143 índices · 76 FK · 40 CHECK · 12 crons · 8 Edge Functions · 1 bucket privado.

**Volumen de datos:** 2 negocios · 5 pacientes · 14 turnos · 6 mensajes de historial · 3 usuarios auth · 1 super-admin. La base está prácticamente vacía: ningún hallazgo de rendimiento es medible a esta escala.

---

## 2. Hallazgos

| # | Sev | Hallazgo |
|---|---|---|
| **I1** | 🔴 | **La base no es reproducible desde el repositorio.** 127 migraciones aplicadas en producción contra 27 archivos en `supabase/migrations/`. Faltan 100, incluyendo todo el modelo comercial, Finanzas v2, vouchers, agenda avanzada, Centro IA y el pipeline. Un restore desde código da un sistema distinto |
| **I2** | 🟠 | **6 funciones ejecutables por `anon`** (sin autenticar): `get_cash_sessions(int,int)`, `get_payment_plans(text,int,int)`, `get_user_business_id()`, `has_feature()`, `is_business_active()`, `user_has_permission()`. Verificado que hoy devuelven 0 filas porque `get_user_business_id()` es NULL sin JWT — **no hay fuga**, pero es superficie innecesaria que depende de un solo comportamiento. Las dos de finanzas son overloads nuevos: el `REVOKE` se aplicó a la firma vieja y la nueva nació con `EXECUTE` para PUBLIC |
| **I3** | 🟠 | **14 políticas sin patrón InitPlan.** Re-evalúan `get_user_business_id()` por fila en vez de una vez por consulta. Todas en lo construido recientemente: `cash_sessions`, `finance_settings`, `payment_methods`, `payment_plans` y las 6 de particiones `history`/`audit_log`. **Cada mes nuevo agrega 2 más**, porque `ensure_future_partitions` las crea con el patrón viejo |
| **I4** | 🟠 | **`services` y `offers` no tienen trigger de auditoría.** Son las dos tablas donde vive el precio. Un cambio de precio o de oferta no deja rastro, mientras que `supplies` y `payment_methods` sí se auditan |
| **I5** | 🟠 | **`plan_expires_at` NULL en los 2 negocios.** El cron `run-dunning` corre a diario y no tiene a quién vencer. El ciclo de cobro nunca ha arrancado |
| **I6** | 🟡 | **`whatsapp_token` en texto plano** en 1 de 2 negocios. `supabase_vault` está instalado y sin usar |
| **I7** | 🟡 | **`auth-login` y `create-appointment` existen en el repositorio y no están desplegadas.** O son código muerto o es un deploy pendiente |
| **I8** | 🟡 | **Protección de contraseñas filtradas (HIBP) deshabilitada.** Un clic en Studio → Authentication |
| **I9** | 🟡 | **`clean-message-buffer` corre cada minuto** — 20,160 de las 20,234 ejecuciones de 14 días son de este job sobre una tabla vacía. Cada 5 minutos sobra |
| **I10** | 🟡 | **Sin realtime en `history`.** La publicación cubre `appointments`, `notifications`, `patients` y `pipeline_deals`; los mensajes entrantes de WhatsApp no llegan en vivo al módulo de Conversaciones |

---

## 3. Corrección de un diagnóstico previo

**`get_stats_dashboard` sí devuelve `patient_monthly_stats` e `inquiry_conversion`.** Verificado en producción: la función retorna las 7 llaves y con datos reales (`{asked: 1, booked: 1, not_booked: 0}` y dos meses de serie). La migración `stats_dashboard_clients_and_inquiry` las agregó el 19-jul.

Un diagnóstico anterior de esta sesión concluyó lo contrario leyendo `supabase/migrations/017_core_stats_rpcs.sql`, que está 100 migraciones desactualizado respecto a producción — consecuencia directa de I1. El archivo `027_stats_dashboard_client_conversion.sql` que se había escrito para "arreglarlo" fue eliminado: habría sobrescrito la función buena de producción con una reimplementación sin probar.

**Las gráficas de Inteligencia se ven estáticas porque hay 5 pacientes y 14 turnos en toda la base**, no porque el RPC falle.

---

## 4. Seguridad

### 4.1 Migraciones

| | |
|---|---|
| Aplicadas en producción | **127** (`20260324000255` → `20260726050914`) |
| Archivos en el repositorio | **27** |
| Faltantes | **100** |

Lo no versionado incluye: precios y límites de planes, `usage_counters` y `record_usage`, `ai_paused`, `limit_overrides`, cobranza (`payments`, `record_payment`, `run_dunning`), retención por plan, presupuesto de tokens IA, Finanzas v2 completa, vouchers, agenda avanzada, RBAC v2 y los triggers de límites — que el repositorio, además, **elimina** en `010_plan_soft_limits.sql`.

### 4.2 Superficie expuesta

| Rol | Funciones ejecutables |
|---|---|
| `anon` | 6 |
| `authenticated` | 50 |
| solo `service_role` | 41 |

Las sensibles están bien cerradas — verificado que `record_usage`, `record_ai_usage`, `check_ai_budget`, `pipeline_touch`, `reactivate_bot`, `record_payment`, `run_dunning`, `check_rate_limit` y `ensure_future_partitions` son **exclusivas de `service_role`**, sin acceso desde `anon` ni `authenticated`.

Prueba ejecutada como `anon` (en transacción con ROLLBACK):

| Llamada | Resultado |
|---|---|
| `get_user_business_id()` | NULL |
| `get_cash_sessions(100,0)` | 0 filas |
| `get_payment_plans(NULL,100,0)` | 0 filas |
| `user_has_permission('manage_roles')` | false |

### 4.3 RLS

107 políticas sobre 34 tablas. 38 incluyen el gate `is_business_active()` en escrituras, así que un negocio suspendido no puede escribir.

Tres tablas tienen RLS activo y **cero políticas** — `api_rate_limits`, `app_super_admins`, `payments` — lo que las deja inaccesibles para `anon` y `authenticated`, y solo operables por `service_role`. Es el diseño correcto para esas tres.

La única política `USING (true)` es `plans_select`: el catálogo de planes es público a propósito, lo necesita la pantalla de precios.

Ambas vistas (`services_with_active_offer`, `v_service_cost`) tienen `security_invoker=true`.

### 4.4 Gating de features en la base

Solo **2 de 107** políticas verifican `has_feature()`, y ambas son de Centro IA (`ai_insights`, `ai_chat_messages`). El resto de módulos premium — finanzas, insumos, ofertas, pipeline — se gatean **únicamente en el frontend**: un tenant Básico con su JWT podría escribir en esas tablas vía API REST. Riesgo bajo hoy; el patrón correcto ya existe y está aplicado en dos lugares.

### 4.5 Otros

| | |
|---|---|
| Edge Functions | 8, todas ACTIVE y con `verify_jwt: true` |
| Storage | 1 bucket `exports`, privado |
| Extensiones | 9, todas fuera de `public` (`extensions`, `pg_catalog`, `vault`) |
| RBAC | 4 roles, 43 claves de permiso distintas |
| Advisor de seguridad | **0 ERROR** · 57 WARN · 3 INFO |

---

## 5. Rendimiento y mantenimiento

### 5.1 Políticas sin InitPlan

61 políticas usan `(SELECT get_user_business_id())` — evaluación única por consulta. **14 usan la llamada directa**, que Postgres re-evalúa por fila:

| Tabla | Políticas |
|---|---|
| `payment_methods` | select, update, delete |
| `finance_settings` | select, update |
| `payment_plans` | select, update |
| `cash_sessions` | select |
| `history_y2026m07/08/09` | select |
| `audit_log_y2026m07/08/09` | select |

El patrón es claro: **los módulos construidos después de la optimización no la adoptaron**, y las particiones nuevas la reproducen cada mes.

### 5.2 Índices

143 índices. El advisor marca 26 como no usados y 10 claves foráneas sin índice de cobertura (`ai_chat_messages.staff_user_id`, `ai_insights.generated_by`, `cash_sessions.opened_by/closed_by`, `income_entries.staff_id`, `payment_plans.patient_id/created_by`, `payment_vouchers.patient_id/redeemed_income_id`, `pipeline_events.patient_id`).

**Ninguno de los dos hallazgos es accionable con 14 turnos en la base:** un índice "no usado" con 5 filas simplemente nunca fue elegido por el planner. Ambos se vuelven medibles solo con datos sintéticos a escala.

### 5.3 Triggers

52 triggers. Cobertura de auditoría por tabla:

| Con auditoría | Sin auditoría |
|---|---|
| appointments, patients, cash_sessions, expense_entries, income_entries, finance_categories, payment_methods, payment_plans, payment_vouchers, schedule_exceptions, service_supplies, supplies, staff_roles | **services**, **offers**, pipeline_deals, notifications, businesses, plans, finance_settings, finance_monthly_goals |

Los límites de plan sí están aplicados en la base: `trg_enforce_patient_limit` (+ restore), `trg_enforce_staff_limit` (+ reactivate) y `trg_enforce_appointment_limit`.

### 5.4 Crons

12 jobs activos. En 14 días: **20,234 ejecuciones, 20,233 exitosas**, 1 fallo (`clean-message-buffer`, "job startup timeout", transitorio).

| Job | Frecuencia |
|---|---|
| clean-message-buffer | cada minuto |
| retain-audit-log · run-dunning | diario |
| retain-history · clean-api-rate-limits · retain-notifications · pipeline-maintenance | diario de madrugada |
| ensure-future-partitions | semanal |
| churn-silent-alert | semanal |
| reset-usage-ai-pause · drop-old-partitions · finance-recurring-monthly | mensual |

### 5.5 Particionado

`history` y `audit_log` particionadas por mes: `y2026m07`, `m08`, `m09` + `default`. El cron mantiene 2 meses de horizonte.

---

## 6. Módulos nuevos

Construidos después de la auditoría anterior y verificados aquí por primera vez.

| Módulo | Tablas | Estado |
|---|---|---|
| **Finanzas v2** | `income_entries`, `expense_entries`, `finance_categories`, `finance_settings`, `finance_monthly_goals`, `cash_sessions`, `supplies`, `service_supplies` | ✅ RLS correcta, DELETE bloqueado en los libros (soft-void), auditoría completa · ⚠️ InitPlan faltante en 4 políticas |
| **Cobros y vouchers** | `payment_vouchers`, `payment_plans`, `payment_methods`, `payments` | ✅ RLS y auditoría · ⚠️ InitPlan faltante · ⚠️ `get_payment_plans` y `get_cash_sessions` expuestas a `anon` |
| **Centro IA** | `ai_insights`, `ai_chat_messages`, `ai_usage_weekly` | ✅ **Único módulo con gating de feature en la base** · presupuesto de tokens solo `service_role` |
| **Pipeline CRM** | `pipeline_deals`, `pipeline_events` | ✅ RLS, realtime activo, cron de mantenimiento · ⚠️ sin trigger de auditoría |
| **Agenda avanzada** | `schedule_exceptions` | ✅ RLS y auditoría completas |
| **Consumo y planes** | `usage_counters`, `plans` | ⚠️ `usage_counters.messages` es un solo contador sin dirección (§7) |

---

## 7. Verificación del modelo de negocio

Contraste de lo que la base tiene hoy contra la escalera de [Modelo de Negocio](Modelo%20de%20Negocio.md).

| | Básico | Pro | Enterprise |
|---|---|---|---|
| Precio (real) | Q599 | Q1,999 | Q3,999 |
| Mensajes (real / objetivo) | **500** / 1,050 | **5,000** / 3,000 | **20,000** / 6,750 |
| Pacientes (real / objetivo) | **50** / 70 | **150** / 200 | **∞** / 450 |
| Turnos (real) | 100 | 500 | ∞ |
| Tokens IA/semana (real) | 0 | 750,000 | 2,000,000 |
| Retención (real / objetivo) | **3** / 3 | **3** / 6 | **12** / 12 |

Los precios están correctos; **los cupos y la retención de Pro no** — es el trabajo B3 del backlog.

**`usage_counters` confirmado:** columnas `messages`, `tokens_in`, `tokens_out`, `tokens_total`. Hay un solo contador de mensajes **sin separar dirección**, tal como estaba documentado.

**Corrección sobre los tokens del bot:** sí se registran. Datos reales del negocio activo en julio: **17 mensajes, 7,991 tokens de entrada, 1,080 de salida** — 534 tokens por mensaje, con un costo real de **Q0.0024 por mensaje**. El presupuesto del modelo de negocio asume Q0.015 por mensaje de componente IA, o sea **6× más de lo que se está consumiendo**. Lo que falta no es medición sino un **techo**: nada corta por tokens del bot, solo por cantidad de mensajes.

**`record_usage` verificado:** acumula por mes, respeta `limit_overrides->>'max_conversations'` y activa `ai_paused = true` con motivo `usage_limit` al alcanzar el cupo. El corte automático funciona.

---

## 8. Acciones

| # | Acción | Cierra |
|---|---|---|
| A1 | Volcar el esquema de producción a migraciones versionadas y exigir archivo antes de aplicar | I1 |
| A2 | `REVOKE EXECUTE ... FROM anon` en las 6 funciones expuestas | I2 |
| A3 | Reescribir las 14 políticas con `(SELECT get_user_business_id())` y **corregir `ensure_future_partitions`** para que las particiones nuevas nazcan con el patrón bueno | I3 |
| A4 | Trigger de auditoría en `services` y `offers` | I4 |
| A5 | `plan_expires_at` a los 2 negocios y en el alta de `onboard-tenant` | I5 |
| A6 | Separar `messages_in` / `messages_out` en `usage_counters` | §7 |
| A7 | Cargar los cupos objetivo en `plans` | §7 |
| A8 | Migrar `whatsapp_token` a Vault | I6 |
| A9 | Desplegar o eliminar `auth-login` y `create-appointment` | I7 |
| A10 | Activar HIBP en Studio | I8 |
| A11 | `clean-message-buffer` cada 5 minutos | I9 |
| A12 | Agregar `history` a la publicación de realtime | I10 |
| A13 | Índices de cobertura en las 10 FK + prueba de carga sintética antes de decidir podas | §5.2 |
| A14 | Extender `has_feature()` a las políticas de escritura de tablas premium | §4.4 |

**Orden:** A1 primero — sin trazabilidad, cada corrección posterior amplía la deuda. Luego A2, A5, A6 y A7, que son los que tocan seguridad y cobro. El resto no corre prisa.
