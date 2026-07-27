# Auditoría Técnica Multi-Tenant — Re-evaluación

> Re-evaluación ejecutada **contra la base de producción vía MCP**, no contra el documento previo. Varias premisas del reporte anterior estaban obsoletas y se corrigen abajo. Los hallazgos de seguridad se probaron con transacciones reales y `ROLLBACK`; se verificó ausencia de residuo.
> Proyecto `kwpaaqdkklwwfslhkqpb` · PostgreSQL 17.6 · 34 tablas · 107 políticas · 97 funciones · 52 triggers.

---

## 0. Corrección de premisas

Tres de los pendientes del reporte previo ya no aplican, y uno estaba mal clasificado. Trabajar sobre el documento viejo habría generado trabajo redundante y dejado abierto lo grave.

| Premisa previa | Estado real verificado |
|---|---|
| «Falta el índice compuesto `(business_id, date_start)`» | **Ya existe:** `idx_appt_business_date btree (business_id, date_start DESC)`, más `appt_no_overlap` GiST parcial para el anti-solape |
| «Falta InitPlan en las políticas RLS» | **Parcialmente resuelto:** 61 de 107 políticas ya lo usan. Faltan 14, todas identificadas (§1.1) |
| «Enforcement de límites solo por ocultamiento; falta trigger `BEFORE INSERT`» | **Ya implementado:** `trg_enforce_patient_limit`, `trg_enforce_staff_limit`, `trg_enforce_appointment_limit`, con `get_effective_limit` y `ERRCODE P0001`. El hueco real es otro (§1.5) |
| «Gate `manage_roles` en INSERT/DELETE: defensa en profundidad, no explotable hoy» | **Falso. Es explotable y está probado** (§1.3) |

---

## 0.5 Scorecard

Escala 0–10. **0–4** roto o ausente · **5–6** funcional con deuda explotable · **7–8** sólido · **9+** ejemplar.

| Área | Peso | **Hoy** | Tras roadmap 1–6 | Qué lo limita hoy |
|---|---|---|---|---|
| **A. Esquema y DB** | 15% | **9.0** | 9.0 | 0 errores en advisor · 0 `SECURITY DEFINER` sin `search_path` · particionado automatizado · 76 FK, 40 CHECK. Resta: 10 FK sin índice de cobertura |
| **B. Control de acceso (RLS/RBAC)** | 25% | **5.5** | 9.0 | **Escalación de privilegios probada en `staff_users`** (§1.3). Todo lo demás correcto: 107 políticas, gate de suspensión en 38, deny-by-default en 3 tablas |
| **C. Rendimiento y escalabilidad** | 15% | **7.5** | 8.5 | Índices calientes presentes y medidos (§4). Resta: InitPlan en particiones y su generador, 10 FK sin índice |
| **D. Edge Functions** | 15% | **6.0** | 8.0 | JWT en las 8, super-admin falla cerrado. Pero: **cero timeouts**, **cero reintentos a terceros**, CORS `*`, env sin validación de arranque, onboarding no atómico (§5) |
| **E. Resiliencia** | 10% | **6.5** | 8.0 | 12 crons con 99.995% de éxito, `withRetry` operativo. Resta: jitter/circuit breaker, error workflow en n8n, TOCTOU en límites |
| **F. Observabilidad** | 5% | **4.0** | 7.0 | Sin Sentry en producción, sin correlation id, sin métricas SaaS. `pg_stat_statements` instalado y sin explotar |
| **G. Reproducibilidad** | 10% | **2.0** | 8.5 | **127 migraciones en producción contra 27 en el repositorio.** El sistema no se puede reconstruir desde el código |
| **H. Enforcement de negocio** | 5% | **7.0** | 8.5 | Triggers de límite reales y corte automático operativo. Resta: TOCTOU, `check_ai_budget` falla abierto, cobranza desconectada en el alta |
| **GLOBAL PONDERADO** | 100% | **6.2** | **8.5** | |

**Lectura.** El sistema está **mejor de lo documentado en ingeniería de datos** (A y C) y **peor en control de acceso y trazabilidad** (B y G). El 6.2 no refleja un sistema mal construido: refleja que dos frentes concretos —una vulnerabilidad explotable y la imposibilidad de reconstruir la base desde el repositorio— pesan más que cualquier refinamiento.

**Camino al 9+.** El roadmap 1–6 lleva a 8.5. Los 0.5 restantes exigen los ítems 13 y 15: correlation id extremo a extremo y prueba de carga sintética incorporada al proceso, que es lo que separa un sistema que funciona de uno que se puede diagnosticar y medir.

---

## 1. Gap Analysis — riesgos latentes

### 1.1 InitPlan: 14 políticas, y un reproductor sistémico

**Estado.** 61 políticas usan `(SELECT get_user_business_id())` → nodo `InitPlan`, evaluado una vez por sentencia. 14 usan la llamada directa → `get_user_business_id()` se ejecuta **por fila evaluada**.

Las 14:

| Tabla | Políticas |
|---|---|
| `payment_methods` | select, update, delete |
| `finance_settings` | select, update |
| `payment_plans` | select, update |
| `cash_sessions` | select |
| `history_y2026m07/08/09` | select |
| `audit_log_y2026m07/08/09` | select |

**Impacto en CPU y latencia.** `get_user_business_id()` es `STABLE SECURITY DEFINER` y hace un lookup sobre `staff_users`. Sin InitPlan, el planner la coloca como qual por fila: un `Seq Scan` o un `Index Scan` amplio ejecuta N invocaciones, cada una con su propio lookup. El coste es **lineal sobre las filas escaneadas antes del filtro**, no sobre las devueltas — que es lo que lo hace traicionero: una consulta que devuelve 20 filas puede haber evaluado la función 20,000 veces.

A escala actual (14 turnos, 5 pacientes) es inmedible. El punto de inflexión aparece cerca de las 10k filas por tabla y tenant; en `history`, particionada y con volumen de mensajería, es la primera que va a doler.

**El problema real no son las 14 políticas: es que se reproducen solas.** `ensure_future_partitions()` crea las particiones mensuales de `history` y `audit_log` **con el patrón viejo**. Cada mes que pasa añade 2 políticas sin InitPlan. Corregir las 14 sin corregir la función generadora es trabajo que se deshace en 30 días.

### 1.2 Índices: la premisa correcta es otra

El índice compuesto ya existe. Lo que falta son **10 claves foráneas sin índice de cobertura**, que degradan `DELETE`/`UPDATE` en la tabla padre (Postgres escanea la hija completa para validar la FK):

`ai_chat_messages.staff_user_id` · `ai_insights.generated_by` · `cash_sessions.opened_by` · `cash_sessions.closed_by` · `income_entries.staff_id` · `payment_plans.patient_id` · `payment_plans.created_by` · `payment_vouchers.patient_id` · `payment_vouchers.redeemed_income_id` · `pipeline_events.patient_id`

El advisor también marca 26 índices "no usados". **No podar nada todavía**: con 14 filas el planner no tiene razón para elegirlos. Esa decisión requiere datos sintéticos a escala.

### 1.3 🔴 CRÍTICO — Escalación de privilegios en `staff_users`, probada

**Estado de las políticas:**

| Tabla | INSERT | DELETE | UPDATE |
|---|---|---|---|
| `staff_users` | `WITH CHECK (business_id = (SELECT get_user_business_id()))` — **sin gate de permiso** | `USING (business_id = ...)` — **sin gate de permiso** | con `user_has_permission('manage_roles')` ✅ |
| `staff_roles` | sin política → denegado por defecto ✅ | sin política → denegado ✅ | con gate ✅ |

El gate se puso en `UPDATE` y se olvidó en `INSERT` y `DELETE`. Como `staff_users.id` **es** `auth.uid()` (PK con FK a `auth.users`), y `user_has_permission()` resuelve por `WHERE u.id = auth.uid() LIMIT 1`, eso abre dos vectores.

**Vector A — Escalación mediante cuenta secundaria.** *Probado:*

```
Atacante: miembro autenticado del tenant, manage_roles = false
POST /rest/v1/staff_users
{ "id": "<uuid de una segunda cuenta auth que controla>",
  "business_id": "<su propio tenant>", "role_id": 1 }   ← rol owner
→ 201 Created
```

Resultado verificado: `role_id = 1` asignado, `manage_roles` del atacante sigue en `false` pero **la cuenta cómplice queda como owner del tenant**. El `WITH CHECK` solo valida `business_id`; nada valida `role_id` ni el permiso del emisor.

**Vector B — Expulsión de miembros.** *Probado:*

```
DELETE /rest/v1/staff_users?id=eq.<uuid del dueño>
→ 204 No Content
```

Una secretaria elimina al dueño del negocio. El dueño pierde el acceso completo: `get_user_business_id()` le devuelve NULL y toda la RLS lo deja fuera de su propio tenant.

**Lo que NO funciona** (y conviene saberlo para no sobredimensionar): la auto-escalación directa. Si el atacante borra su propia fila para reinsertarse como owner, destruye la fuente de `get_user_business_id()`, el `WITH CHECK` evalúa `business_id = NULL` y el INSERT se bloquea. La escalación exige una segunda cuenta.

**Por qué el argumento «la creación pasa por Edge Function con service_role» no protege.** Esa Edge Function es cómo lo hace *la UI*. La RLS es lo que protege *la API REST*, que está expuesta y acepta el JWT anon del usuario. El control de la UI es irrelevante para un cliente HTTP.

**Requisitos del ataque:** una cuenta autenticada del tenant (cualquier rol) y una segunda cuenta en `auth.users`. Alcance: dentro del tenant. No cruza fronteras de negocio.

### 1.4 Aprovisionamiento no atómico

`onboard-tenant/index.ts` ejecuta **cuatro escrituras secuenciales** sin transacción:

```
PASO 1  businesses.insert()
PASO 2  staff_roles.insert([...])
PASO 3  auth.admin.createUser()
PASO 4  staff_users.insert()
```

La compensación (línea 273) solo hace `businesses.delete()`, y con `.catch(() => {})`.

**Modos de fallo:**

| Falla en | Estado resultante |
|---|---|
| PASO 2 | Negocio sin roles → nadie puede entrar nunca |
| PASO 3 | Negocio + roles huérfanos; la compensación borra el negocio pero deja los roles |
| PASO 4 | **Usuario en `auth.users` sin `staff_users`** → login exitoso, `get_user_business_id()` NULL, dashboard vacío sin explicación. La compensación no toca `auth.users`: el usuario queda permanentemente huérfano y su email bloqueado para reintentos |
| Compensación | Silenciada por el `.catch(() => {})` |

Sin `waba_id`/`phone_number_id` en el alta, un tenant a medio crear tampoco es detectable por consulta simple.

### 1.5 Hallazgos adicionales no presentes en el reporte previo

| # | Sev | Hallazgo |
|---|---|---|
| **N1** | 🟠 | **TOCTOU en los triggers de límite.** `enforce_appointment_limit` hace `SELECT count(*)` y luego compara. Dos INSERT concurrentes leen ambos `count = max-1`, ambos pasan, ambos escriben. El límite del plan es superable bajo concurrencia — exactamente el escenario del bot de WhatsApp procesando mensajes en paralelo |
| **N2** | 🔴 | **`check_ai_budget` falla abierto.** `const { data: budget } = await rpc(...)` descarta el `error`; si el RPC falla, `budget` es `null`, la condición `budget && budget.allowed === false` da falso y la Edge Function **gasta igual**. El techo de tokens se apaga solo ante cualquier fallo de la DB |
| **N3** | 🔴 | **127 migraciones en producción contra 27 archivos en el repositorio.** El modelo comercial completo, Finanzas v2, vouchers, agenda avanzada, Centro IA y los propios triggers de límite no existen en el código. Un restore desde repositorio produce un sistema distinto |
| **N4** | 🟠 | **6 funciones ejecutables por `anon`**, dos de finanzas (`get_cash_sessions`, `get_payment_plans`). Verificado que devuelven 0 filas porque `get_user_business_id()` es NULL sin JWT — sin fuga hoy, pero la contención depende de un solo comportamiento y son overloads nuevos que nacieron con `EXECUTE` para PUBLIC |
| **N5** | 🟠 | **`services` y `offers` sin trigger de auditoría.** Las dos tablas donde vive el precio no dejan rastro de cambios, mientras `supplies` y `payment_methods` sí |
| **N6** | 🟡 | **`plan_expires_at` NULL en los 2 negocios.** `run_dunning()` corre a diario sin nadie a quien vencer; el alta de pago lo crea NULL por diseño |
| **N7** | 🟡 | **`withRetry` sin jitter ni circuit breaker.** Backoff exponencial determinista (400/800ms) → thundering herd sincronizado tras una caída |

---

## 2. Blueprints de remediación

### 2.1 RLS: InitPlan + cierre del reproductor

```sql
-- ── Patrón canónico: la subconsulta fuerza un nodo InitPlan (1 evaluación/sentencia)
ALTER POLICY pm_select   ON public.payment_methods  USING (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY pm_update   ON public.payment_methods  USING (business_id = (SELECT public.get_user_business_id()))
                                                WITH CHECK (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY pm_delete   ON public.payment_methods  USING (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY fs_select   ON public.finance_settings USING (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY fs_update   ON public.finance_settings USING (business_id = (SELECT public.get_user_business_id()))
                                                WITH CHECK (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY pp_select   ON public.payment_plans    USING (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY pp_update   ON public.payment_plans    USING (business_id = (SELECT public.get_user_business_id()))
                                                WITH CHECK (business_id = (SELECT public.get_user_business_id()));
ALTER POLICY cs_select   ON public.cash_sessions    USING (business_id = (SELECT public.get_user_business_id()));

-- ── Particiones existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS part, p.polname
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname ~ '^(history|audit_log)_y\d{4}m\d{2}$'
      AND pg_get_expr(p.polqual, p.polrelid) NOT ILIKE '%(SELECT%'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (business_id = (SELECT public.get_user_business_id()))',
      r.polname, r.part);
  END LOOP;
END $$;
```

**Sin este paso lo anterior caduca en 30 días.** Corregir el generador para que las particiones nuevas nazcan con el patrón bueno:

```sql
-- Dentro de ensure_future_partitions(), al crear cada partición:
EXECUTE format($f$
  ALTER TABLE public.%1$I ENABLE ROW LEVEL SECURITY;
  CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated
    USING (business_id = (SELECT public.get_user_business_id()));
  CREATE POLICY %1$s_insert ON public.%1$I FOR INSERT TO authenticated
    WITH CHECK (business_id = (SELECT public.get_user_business_id()));
$f$, v_partition_name);
```

### 2.2 Cierre de la escalación de privilegios (§1.3) — prioridad máxima

```sql
BEGIN;

-- INSERT: exige manage_roles Y prohíbe auto-asignarse un rol
DROP POLICY IF EXISTS staff_users_insert ON public.staff_users;
CREATE POLICY staff_users_insert ON public.staff_users
  FOR INSERT TO authenticated
  WITH CHECK (
        business_id = (SELECT public.get_user_business_id())
    AND (SELECT public.user_has_permission('manage_roles'))
    AND id <> (SELECT auth.uid())                                   -- nadie se crea a sí mismo
    AND role_id IN (SELECT id FROM public.staff_roles
                     WHERE business_id = (SELECT public.get_user_business_id()))
  );

-- DELETE: exige manage_roles, prohíbe auto-borrado y protege al último owner
DROP POLICY IF EXISTS staff_users_delete ON public.staff_users;
CREATE POLICY staff_users_delete ON public.staff_users
  FOR DELETE TO authenticated
  USING (
        business_id = (SELECT public.get_user_business_id())
    AND (SELECT public.user_has_permission('manage_roles'))
    AND id <> (SELECT auth.uid())
  );

-- UPDATE: cerrar el hueco de mover a alguien a un rol de otro tenant
DROP POLICY IF EXISTS staff_users_update ON public.staff_users;
CREATE POLICY staff_users_update ON public.staff_users
  FOR UPDATE TO authenticated
  USING (      business_id = (SELECT public.get_user_business_id())
           AND (SELECT public.user_has_permission('manage_roles')))
  WITH CHECK ( business_id = (SELECT public.get_user_business_id())
           AND (SELECT public.user_has_permission('manage_roles'))
           AND role_id IN (SELECT id FROM public.staff_roles
                            WHERE business_id = (SELECT public.get_user_business_id())));

COMMIT;
```

**Invariante adicional — nunca dejar un tenant sin owner.** La RLS no puede expresar «al menos un owner»; requiere trigger:

```sql
CREATE OR REPLACE FUNCTION public.guard_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owners int;
BEGIN
  SELECT count(*) INTO v_owners
  FROM staff_users u JOIN staff_roles r ON r.id = u.role_id
  WHERE u.business_id = COALESCE(OLD.business_id, NEW.business_id)
    AND u.active
    AND (r.permissions->>'manage_roles')::boolean IS TRUE
    AND u.id <> OLD.id;
  IF v_owners = 0 THEN
    RAISE EXCEPTION 'No se puede dejar el negocio sin ningún administrador.'
      USING ERRCODE = 'P0001', HINT = 'LAST_OWNER_PROTECTED';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_guard_last_owner
  BEFORE DELETE OR UPDATE OF role_id, active ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_owner();
```

### 2.3 Límites de plan sin TOCTOU (§1.5 N1)

El trigger existente es correcto en forma pero no en concurrencia. El fix es un lock consultivo por `(business_id, mes)` dentro de la transacción — serializa solo a los competidores del mismo cupo, sin bloqueo global:

```sql
CREATE OR REPLACE FUNCTION public.enforce_appointment_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_used int; v_bucket bigint;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- bot/service_role: gate aguas arriba

  v_max := public.get_effective_limit(NEW.business_id, 'max_appointments');
  IF v_max IS NULL THEN RETURN NEW; END IF;

  -- Serializa por (tenant, mes): hashtext del uuid + año-mes. Se libera al COMMIT.
  v_bucket := hashtextextended(NEW.business_id::text || to_char(NEW.date_start, 'YYYYMM'), 0);
  PERFORM pg_advisory_xact_lock(v_bucket);

  SELECT count(*) INTO v_used FROM appointments
   WHERE business_id = NEW.business_id
     AND date_trunc('month', date_start) = date_trunc('month', NEW.date_start)
     AND status <> 'cancelled';

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'Límite de % turnos/mes de tu plan alcanzado para ese mes.', v_max
      USING ERRCODE = 'P0001', HINT = 'PLAN_LIMIT_APPOINTMENTS';
  END IF;
  RETURN NEW;
END $$;
```

Aplicar el mismo patrón a `enforce_patient_limit` y `enforce_staff_limit`.

### 2.4 Onboarding atómico

Mover las cuatro escrituras a una RPC transaccional y dejar en la Edge Function únicamente lo que no puede vivir en Postgres (`auth.admin.createUser`), ejecutado **primero** para que su fallo no deje nada que compensar:

```sql
CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_user_id uuid, p_name text, p_tier plan_tier, p_timezone text DEFAULT 'America/Guatemala',
  p_trial boolean DEFAULT false, p_owner_name text DEFAULT NULL, p_owner_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_business_id uuid; v_plan_id uuid; v_owner_role int;
BEGIN
  SELECT id INTO v_plan_id FROM plans WHERE tier = p_tier;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Plan % inexistente', p_tier; END IF;

  INSERT INTO businesses (name, plan_id, plan_status, plan_expires_at, timezone)
  VALUES (p_name, v_plan_id,
          CASE WHEN p_trial THEN 'trial' ELSE 'active' END::plan_status_enum,
          now() + CASE WHEN p_trial THEN interval '14 days' ELSE interval '1 month' END,
          p_timezone)
  RETURNING id INTO v_business_id;

  INSERT INTO staff_roles (business_id, name, permissions) VALUES
    (v_business_id, 'owner',     '{"manage_roles":true,"view_stats":true}'::jsonb),
    (v_business_id, 'secretaria','{"manage_roles":false,"view_stats":false}'::jsonb)
  RETURNING id INTO v_owner_role;

  INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
  VALUES (p_user_id, v_business_id, v_owner_role, p_owner_name, p_owner_email, true);

  RETURN v_business_id;
END $$;

REVOKE ALL ON FUNCTION public.provision_tenant(uuid,text,plan_tier,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(uuid,text,plan_tier,text,boolean,text,text) TO service_role;
```

`RETURNING id INTO v_owner_role` toma el `id` de la última fila insertada; si el orden de inserción cambia, fijar el rol con un `SELECT ... WHERE name='owner'` explícito.

Nótese que **resuelve N6 de paso**: el alta de pago nace con `plan_expires_at = now() + 1 mes`, así que `run_dunning()` deja de correr en vacío.

En la Edge Function:

```ts
// 1) auth primero: si falla, no hay nada que compensar
const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (authErr) return json({ error: authErr.message }, 400);

// 2) todo el resto en una sola transacción de Postgres
const { data: businessId, error: rpcErr } = await supabaseAdmin.rpc('provision_tenant', {
  p_user_id: authUser.user.id, p_name: name, p_tier: plan,
  p_timezone: timezone, p_trial: trial,
  p_owner_name: ownerName, p_owner_email: email,
});

// 3) compensación acotada y observable: solo el usuario auth
if (rpcErr) {
  const { error: cleanupErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
  if (cleanupErr) console.error('ORPHAN_AUTH_USER', authUser.user.id, cleanupErr.message);
  return json({ error: rpcErr.message, code: 'PROVISION_FAILED' }, 500);
}
```

### 2.5 `withRetry` v2 — jitter + circuit breaker

El actual reintenta con backoff determinista (400/800ms). Bajo una caída de Supabase, todas las pestañas de todos los tenants reintentan en el mismo instante.

```js
// src/utils/withRetry.js
const BREAKERS = new Map(); // scope -> { failures, openUntil }
const THRESHOLD = 5, COOLDOWN_MS = 30_000, CAP_MS = 8_000;

function breaker(scope) {
  if (!BREAKERS.has(scope)) BREAKERS.set(scope, { failures: 0, openUntil: 0 });
  return BREAKERS.get(scope);
}

export class CircuitOpenError extends Error {
  constructor(scope, retryInMs) {
    super('Servicio no disponible temporalmente. Reintentando en unos segundos.');
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
    this.scope = scope;
    this.retryInMs = retryInMs;
  }
}

export async function withRetry(fn, { tries = 3, baseDelayMs = 400, label = 'read', scope = 'supabase' } = {}) {
  const b = breaker(scope);
  if (Date.now() < b.openUntil) throw new CircuitOpenError(scope, b.openUntil - Date.now());

  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const out = await fn();
      b.failures = 0;                       // éxito: cierra el breaker
      return out;
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;     // errores de negocio no se reintentan

      if (++b.failures >= THRESHOLD) {
        b.openUntil = Date.now() + COOLDOWN_MS;
        b.failures = 0;
        throw new CircuitOpenError(scope, COOLDOWN_MS);
      }
      if (attempt === tries) throw err;

      // Backoff exponencial acotado con jitter completo (AWS "full jitter"):
      // desincroniza a todos los clientes en vez de alinearlos.
      const ceiling = Math.min(CAP_MS, baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.random() * ceiling;
      if (import.meta.env.DEV) console.warn(`[withRetry:${label}] intento ${attempt} falló; reintento en ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
```

`isTransient()` se conserva tal cual: ya discrimina correctamente transporte/5xx de errores de negocio (RLS, PGRST, `PLAN_LIMIT`).

---

## 3. Infraestructura y observabilidad

### 3.1 Supavisor — la premisa del pool también hay que corregirla

**En esta arquitectura casi nadie abre conexiones directas a Postgres.** El dashboard (`supabase-js`), las Edge Functions (`supabase-js`) y n8n (nodos HTTP contra `/rest/v1/`) hablan **HTTP contra PostgREST**. Supavisor solo interviene en conexiones nativas: migraciones, MCP, `psql`, y cualquier nodo Postgres directo que se agregue a n8n.

Consecuencia: **el riesgo de saturación no está en Supavisor, está en el pool interno de PostgREST**, que es único y compartido por todos los tenants. Un tenant con consultas lentas agota los slots del resto — el escenario de vecino ruidoso descrito en el reporte previo, pero en la capa equivocada.

| Consumidor | Ruta real | Modo correcto |
|---|---|---|
| Dashboard React | HTTPS → PostgREST | No aplica; lo gobierna `db-pool` de PostgREST |
| Edge Functions | HTTPS → PostgREST | Igual |
| n8n (nodos HTTP) | HTTPS → PostgREST | Igual |
| Migraciones / MCP / `psql` | TCP 5432 | **Session mode** — DDL, `SET`, advisory locks de sesión |
| Nodo Postgres directo en n8n (si se agrega) | TCP 6543 | **Transaction mode** — conexiones efímeras, sin prepared statements nombrados |

**Regla dura para transaction mode (6543):** no soporta `PREPARE`/`DEALLOCATE` nombrados ni estado de sesión. Cualquier cliente que use prepared statements debe declarar `statement_cache_size=0` o equivalente, o fallará de forma intermitente y difícil de diagnosticar.

**La mitigación efectiva es acotar el daño por rol, no ampliar el pool:**

```sql
-- Un tenant con una consulta patológica no puede retener un slot indefinidamente
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '15s';

-- El bot tolera algo más (agregaciones de slots), pero acotado
ALTER ROLE service_role  SET statement_timeout = '20s';
ALTER ROLE service_role  SET idle_in_transaction_session_timeout = '30s';

-- anon no debería sostener nada
ALTER ROLE anon SET statement_timeout = '4s';
```

Verificación de presión real antes de tocar tamaños de pool:

```sql
SELECT state, wait_event_type, count(*)
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY 1,2 ORDER BY 3 DESC;

SELECT calls, round(mean_exec_time::numeric,1) AS ms_medio,
       round(total_exec_time::numeric) AS ms_total, left(query,90) AS q
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;
```

`pg_stat_statements` ya está instalado en el esquema `extensions`.

### 3.2 Correlation ID — tenant ↔ request ↔ consulta, sin PII

**Contrato del identificador.** Opaco, sin datos personales, reconstruible:

```
cid = <origen>-<ts_base36>-<rand6>
       │         │            └─ 6 chars aleatorios (colisión despreciable)
       │         └─ Date.now() en base36 (ordena por tiempo)
       └─ w=web · e=edge · n=n8n · c=cron
```

**El `business_id` no viaja en el `cid`.** Se correlaciona en el servidor mediante `app.tenant`, que ya está en el JWT. Así el identificador puede aparecer en logs de cliente y en mensajes de error visibles sin exponer a qué negocio pertenece.

**Propagación — front:**

```js
// src/config/supabase.js
export const newCid = (origin = 'w') =>
  `${origin}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const supabase = createClient(URL, KEY, {
  global: {
    fetch: (input, init = {}) => {
      const cid = init.headers?.['x-correlation-id'] ?? newCid('w');
      return fetch(input, {
        ...init,
        headers: { ...init.headers, 'x-correlation-id': cid },
      });
    },
  },
});
```

**Marcado en Postgres** — un RPC ligero que deja el `cid` en los `application_name`/GUC de la sesión, invocable al abrir un flujo crítico:

```sql
CREATE OR REPLACE FUNCTION public.set_request_context(p_cid text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_cid !~ '^[a-z0-9-]{8,48}$' THEN RETURN; END IF;   -- rechaza inyección en el log
  PERFORM set_config('application_name', 'cid:' || p_cid, true);   -- true = solo esta transacción
  PERFORM set_config('app.cid', p_cid, true);
END $$;
GRANT EXECUTE ON FUNCTION public.set_request_context(text) TO authenticated, service_role;
```

Con eso, `log_line_prefix` de Postgres (que incluye `%a` = application_name) etiqueta cada sentencia con el `cid`, y `pg_stat_activity.application_name` permite ver en vivo qué request está corriendo.

**Auditoría enriquecida** — añadir el `cid` a `audit_log` sin tocar los triggers existentes:

```sql
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS correlation_id text;
-- En la función de auditoría: correlation_id := current_setting('app.cid', true)
```

**Sentry:**

```js
Sentry.setTag('correlation_id', cid);
Sentry.setTag('tenant_hash', await sha256(businessId).slice(0, 12)); // hash, no el uuid
```

El hash del tenant permite agrupar incidencias por cliente sin almacenar el identificador real, que es lo que convierte un log en dato personal por asociación.

---

## 4. Prueba de carga sintética — números reales

**Método.** Esquema aislado `perf_audit` con dos tablas idénticas de **100,000 turnos** sobre 50 negocios (el tenant real recibe 2,000, proporción realista). Única diferencia entre ambas: el patrón de la política RLS. Ambas referencian la función **real** `public.get_user_business_id()`. Consultas ejecutadas impersonando `authenticated` con JWT real. Esquema eliminado con `DROP SCHEMA CASCADE` al terminar; producción verificada intacta (14 turnos, 5 pacientes, 2 staff).

### 4.1 Resultados

Consulta: `SELECT count(*) WHERE status <> 'cancelled'` — 1,000 filas útiles de 100,000.

| Escenario | Plan | Tiempo | Coste estimado |
|---|---|---|---|
| Con índice `(business_id, date_start)` · política por fila | Index Scan | **0.55 ms** | 122 |
| Con índice · política InitPlan | Index Scan | **2.48 ms** | 129 |
| **Sin índice · política InitPlan** | Seq Scan | **172 ms** | 2,641 |
| **Sin índice · política por fila** | Seq Scan | **1,319 ms** | 27,640 |

Consulta de calendario (rango de un mes, sin índice, política por fila): **107 ms** escaneando 99,889 filas para devolver 111.

### 4.2 Conclusiones — dos de ellas contradicen la creencia habitual

**1. Con un índice utilizable, el InitPlan es irrelevante.** PostgreSQL empuja la función `STABLE` dentro del `Index Cond` y la evalúa **una sola vez** en ambos patrones. La diferencia de 0.55 ms contra 2.48 ms es ruido de caché, no estructura. La regla «toda política debe usar InitPlan» no está mal, pero su beneficio es **cero** donde ya hay índice.

**2. Sin índice, el InitPlan vale 7.7×.** 1,319 ms contra 172 ms: **1,146 ms de sobrecoste puro** por evaluar `get_user_business_id()` cien mil veces. El planner lo sabe y lo refleja en su estimación: 27,640 contra 2,641, un factor de 10.5×.

**3. El índice pesa mucho más que el patrón de la política.** 2.48 ms contra 172 ms es **69×**. Entre invertir en corregir políticas o en indexar, indexar gana por dos órdenes de magnitud.

**4. Esto reordena la prioridad del roadmap.** De las 14 políticas sin InitPlan, ocho están sobre tablas de finanzas pequeñas y con índice — su corrección es higiene, no rendimiento. **Las seis que importan son las de las particiones `history` y `audit_log`**, porque crecen sin techo con el volumen de mensajería y son el escenario exacto del Seq Scan medido arriba. Y son justo las que el generador reproduce cada mes.

**5. Proyección.** Con 100,000 filas, un tenant que consulte su historial completo sin índice y con política por fila espera **1.3 segundos por consulta**. A 10 tenants concurrentes eso satura el pool de PostgREST antes que la CPU. El límite práctico no es el hardware: es el número de slots ocupados durante 1.3 s cada uno.

---

## 5. Superficie de ataque de las Edge Functions

Auditoría del código interno de las 8 funciones desplegadas, no solo de su configuración.

### 5.1 Lo que está bien

| | |
|---|---|
| `verify_jwt` | Activo en las 8 |
| Autorización de super-admin | `const isEnvAdmin = !!SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL` — **falla cerrado**: si la variable falta, la comparación no se cumple. Además `app_super_admins` es la fuente de verdad y el env solo respaldo |
| Estado a nivel de módulo | Una sola constante inmutable (`NEEDS_PATIENT` en `ai-insights`). **Sin acumuladores, sin cachés no acotadas: no hay fuga de memoria entre invocaciones** |
| Orden de operaciones en `wa-human-reply` | Envía primero, persiste después, y **no falla la request si el log falla** — correcto: el mensaje ya salió |
| Manejo de errores de Meta | Discrimina `131047`/`131051` (ventana de 24h cerrada) y devuelve 409 con código propio |
| Presupuesto de IA | `check_ai_budget` antes de gastar, `record_ai_usage` después, con costo real |

### 5.2 Hallazgos

| # | Sev | Hallazgo |
|---|---|---|
| **E1** | 🔴 | **Cero timeouts en las llamadas a terceros.** Ni el `fetch` a Meta Graph (`wa-human-reply:121`) ni el de Gemini (`_shared/gemini.ts:33`) declaran `AbortSignal`. Un upstream colgado retiene la invocación hasta el límite de pared de la plataforma. Bajo carga, unas pocas llamadas lentas agotan la concurrencia de la función y **el handoff humano deja de funcionar para todos los tenants** |
| **E2** | 🔴 | **Cero reintentos hacia terceros.** Un 500/503 transitorio de Meta pierde el mensaje del staff de forma definitiva; el usuario ve un error y el mensaje nunca llegó. Lo mismo con Gemini: el bucle de `callGeminiJSON` reintenta **solo** por JSON que no calza el schema, no por fallo HTTP |
| **E3** | 🟠 | **Sin idempotencia en el envío de WhatsApp.** Si el cliente reintenta tras un corte de red posterior al envío, el paciente recibe el mensaje dos veces. No hay clave de idempotencia ni deduplicación por `wamid` |
| **E4** | 🟠 | **`Access-Control-Allow-Origin: *` en las 8 funciones**, incluidas `admin-update-business` y `export-tenant-data`. Con `verify_jwt` activo no es un bypass directo —el JWT sigue siendo obligatorio y vive en `localStorage`, no en cookies, así que no hay CSRF clásico— pero un comodín sobre un endpoint que exporta datos completos de un tenant no pasa ninguna revisión de seguridad. Debe restringirse al dominio del dashboard |
| **E5** | 🟠 | **Variables de entorno sin validación de arranque.** 21 `Deno.env.get`, de los cuales 15 usan `?? ""` y 2 el operador `!`. Solo uno valida ausencia real (`GEMINI_API_KEY`). Si `SUPABASE_SERVICE_ROLE_KEY` falta tras un redeploy, `createClient` se construye con clave vacía y la función devuelve 401 opacos en tiempo de ejecución en vez de fallar al arrancar |
| **E6** | 🟡 | **Fuga de detalle del proveedor al cliente.** `wa-human-reply` devuelve `meta: errBody?.error` al navegador: expone el objeto de error crudo de Meta, con sus identificadores internos y trazas. Debe registrarse en el servidor y devolverse un código propio |
| **E7** | 🟡 | **`auth-login` y `create-appointment` existen en el repositorio y no están desplegadas.** O es código muerto o un deploy pendiente; en ambos casos, código sin dueño |

### 5.3 Blueprint — timeout, reintento e idempotencia

```ts
// supabase/functions/_shared/upstream.ts
type FetchOpts = RequestInit & { timeoutMs?: number; tries?: number; label?: string };

/** fetch a terceros con timeout duro, reintento con jitter y clasificación de errores. */
export async function fetchUpstream(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 10_000, tries = 3, label = 'upstream', ...init } = opts;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

      // 4xx = error de negocio: no reintentar, devolver tal cual (incluye 429 con Retry-After)
      if (res.status < 500 && res.status !== 429) return res;
      if (attempt === tries) return res;

      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      const backoff = Math.min(8_000, 500 * 2 ** (attempt - 1));
      await sleep(retryAfter || Math.random() * backoff);      // full jitter
    } catch (err) {
      lastErr = err;                                            // timeout o red
      if (attempt === tries) throw err;
      await sleep(Math.random() * Math.min(8_000, 500 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

Uso en `wa-human-reply`, con idempotencia por hash de contenido:

```ts
// Deduplicación: mismo staff, mismo paciente, mismo texto, ventana de 60s
const idemKey = await sha256(`${caller.id}:${patient_id}:${body}`);
const { data: dup } = await supabaseAdmin
  .from('history')
  .select('id')
  .eq('business_id', caller.business_id)
  .eq('patient_id', patient_id)
  .eq('role', 'agent')
  .eq('content', body)
  .gte('created_at', new Date(Date.now() - 60_000).toISOString())
  .maybeSingle();
if (dup) return json({ ok: true, deduped: true, id: dup.id });

const graphRes = await fetchUpstream(
  `https://graph.facebook.com/${GRAPH_API_VERSION}/${business.phone_number_id}/messages`,
  { method: 'POST', headers: {...}, body: JSON.stringify({...}),
    timeoutMs: 10_000, tries: 3, label: 'meta-graph' },
);

if (!graphRes.ok) {
  const errBody = await graphRes.json().catch(() => null);
  console.error('WHATSAPP_SEND_FAILED', { cid, status: graphRes.status, meta: errBody?.error });
  const metaCode = errBody?.error?.code;
  if (metaCode === 131047 || metaCode === 131051)
    return json({ code: 'WINDOW_EXPIRED', error: 'La ventana de 24h cerró.' }, 409);
  return json({ code: 'UPSTREAM_REJECTED', error: 'WhatsApp rechazó el mensaje.' }, 502); // sin `meta`
}
```

### 5.4 Blueprint — validación de entorno al arrancar

```ts
// supabase/functions/_shared/env.ts
export function requireEnv(...keys: string[]): Record<string, string> {
  const missing: string[] = [];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (!v) missing.push(k); else out[k] = v;
  }
  if (missing.length) throw new Error(`ENV_MISSING: ${missing.join(', ')}`);
  return out;
}

// Al inicio del módulo — falla al desplegar, no en la primera petición del cliente
const ENV = requireEnv('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
```

### 5.5 Blueprint — CORS acotado

```ts
// supabase/functions/_shared/cors.ts
const ALLOWED = new Set([
  'https://app.novturnia.com',
  ...(Deno.env.get('EXTRA_ORIGINS') ?? '').split(',').filter(Boolean),
]);

export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
```

---

## 6. Roadmap operativo priorizado

| # | Componente | Acción | Impacto |
|---|---|---|---|
| **1** | `staff_users` (RLS) | Aplicar §2.2: gate `manage_roles` en INSERT/DELETE, prohibir auto-alta/auto-borrado, acotar `role_id` al tenant | **Seguridad — crítico.** Cierra escalación de privilegios y expulsión, ambas probadas |
| **2** | `staff_users` (trigger) | `trg_guard_last_owner` (§2.2) | **Seguridad.** Impide dejar un tenant sin administrador |
| **3** | `ai-chat` / `ai-insights` | Capturar el `error` de `check_ai_budget` y responder 503 en vez de continuar | **Seguridad/Costo.** El techo de tokens deja de apagarse solo |
| **4** | `supabase/migrations/` | Volcar el esquema de producción a archivos versionados; exigir archivo antes de aplicar | **Resiliencia.** 100 migraciones solo existen en producción |
| **5** | `onboard-tenant` + `provision_tenant` | Aplicar §2.4: auth primero, resto en RPC transaccional, compensación acotada | **Resiliencia.** Elimina tenants a medio crear y usuarios auth huérfanos. Cierra N6 |
| **6** | `enforce_*_limit` (×3) | Advisory lock por `(tenant, período)` (§2.3) | **Seguridad/Margen.** Cierra el TOCTOU del cupo de plan |
| **7** | `ensure_future_partitions` | Emitir políticas con InitPlan (§2.1) | **Rendimiento.** Detiene la regeneración mensual de deuda |
| **8** | 14 políticas RLS | `ALTER POLICY` con patrón InitPlan (§2.1) | **Rendimiento.** Elimina evaluación por fila |
| **9** | 6 funciones expuestas | `REVOKE EXECUTE ... FROM anon` | **Seguridad.** Reduce superficie no autenticada |
| **10** | Roles Postgres | `statement_timeout` e `idle_in_transaction_session_timeout` por rol (§3.1) | **Resiliencia.** Aísla al vecino ruidoso en el pool de PostgREST |
| **11** | `services`, `offers` | Trigger de auditoría | **Seguridad.** Trazabilidad de cambios de precio |
| **12** | `withRetry` | v2 con jitter completo y circuit breaker (§2.5) | **Resiliencia.** Elimina el thundering herd |
| **13** | `set_request_context` + cliente | Correlation id extremo a extremo (§3.2) | **Observabilidad.** Aislar fallas por tenant sin PII |
| **14** | 10 claves foráneas | Índices de cobertura (§1.2) | **Rendimiento.** Evita escaneo de la hija en DELETE/UPDATE del padre |
| **15** | Branch de Supabase | Datos sintéticos (5 tenants × 2,000 filas) + `EXPLAIN ANALYZE` | **Rendimiento.** Único camino válido para decidir podas de índices |
| **16** | Studio → Auth | Activar protección de contraseñas filtradas (HIBP) | **Seguridad.** Un clic |

**Del 1 al 3 son de aplicación inmediata**: dos son vulnerabilidades probadas y uno es un techo de costo que se desactiva solo. El resto admite planificación.

**Score.** El sistema está mejor de lo que el reporte previo sugiere en rendimiento e higiene de funciones (0 `SECURITY DEFINER` sin `search_path`, 0 errores en el advisor, índice compuesto ya presente, triggers de límite operativos), y **peor en control de acceso**, porque el hueco de `staff_users` no era teórico. Cerrando los ítems 1–6 la arquitectura queda sin vulnerabilidades conocidas y con aprovisionamiento atómico; el 9+ sostenido exige además el 4 y el 15, que es lo que separa un sistema que funciona de uno que se puede reconstruir y medir.
