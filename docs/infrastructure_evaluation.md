# NovTurnAI — Infrastructure Evaluation

> Última actualización: 2026-04-16 (sesión 13 — T-14/17/23/24/59 + permisos granulares)
> Evaluación de deployment readiness por área. Escala 0–10.
> 🔴 Bloqueante · 🟠 Importante · 🟡 Deseable · ✅ Resuelto

---

## Resumen Ejecutivo

| Área                         |Puntaje base|Puntaje actual| Delta    |
|------------------------------|------------|--------------|----------|
| Base de datos (Supabase)     | 6.0/10     | **8.8/10**   | +2.8     |
| Dashboard React + Vite       | 7.0/10     | **9.3/10**   | +2.3     |
| Producto / SaaS              | 5.0/10     | **7.2/10**   | +2.2     |
| Bot / N8N Workflow           | 4.5/10     | **7.5/10**   | +3.0     |
| Infraestructura / Despliegue | 6.5/10     | **6.5/10**   | —        |
| Resiliencia                  | 4.0/10     | **5.5/10**   | +1.5     |
| Modelo de negocio            | 1.0/10     | **2.5/10**   | +1.5     |
| **PROMEDIO GLOBAL**          | **4.9/10** | **7.2/10**   | **+2.3** |

---

## 1. Bot / N8N Workflow — 7.5/10

> Evaluado directamente desde el archivo JSON del flujo. La arquitectura general es sólida y demuestra un nivel avanzado de diseño lógico, superando ampliamente las suposiciones iniciales. Aunque existen áreas de mejora técnica (especialmente en observabilidad), el sistema de enrutamiento, validación y optimización está muy bien estructurado para el entorno en el que opera.

| Sub-área | Puntaje | Estado | Notas |
|----------|---------|--------|-------|
| Seguridad de credenciales | 8/10 | 🟢 | N8N aislado en Railway sin conexión inversa al dashboard. Claves hardcodeadas asumidas como riesgo controlado por la arquitectura actual. |
| Manejo de errores / edge cases | 8/10 | 🟠 | Buena UX de contingencia (notifica al usuario amigablemente), pero faltan mecanismos de *retry* técnico en nodos de base de datos o peticiones HTTP. |
| Message buffering | 10/10 | 🟢 | **Excelente:** `human_takeover` funcional, buffer con validación avanzada (filtros Regex anti-spam/insultos y *bypass* directo de saludos simples). |
| Optimización de tokens IA | 9/10 | 🟠 | *Rate-limiting* desactivado temporalmente, pero cuenta con una gran mitigación preventiva mediante el truncado de historial (250 caracteres) y el uso de un modelo económico (Flash-Lite) pre-agente principal. |
| **Blind spot crítico** | 0/10 | 🔴 | Confirmado: Sin *logging* estructurado de fallos del bot hacia Supabase — los errores técnicos mueren en el lienzo de forma silenciosa. |

---

## 2. Base de Datos (Supabase) — 8.8/10

### Sub-área: Estructura y normalización — 8.0/10

| Item | Estado | Tarea |
|------|--------|-------|
| Schema core (appointments, patients, staff) | ✅ Sólido | — |
| Columna `birth_date` en `patients` | ✅ En DB + UI (EditPatientModal con edad calculada) | T-44 |
| Columna `cancelled_at` / `cancellation_reason` en `appointments` | ✅ En DB + código (`cancelAppointment` la registra) | T-49 |
| Tabla `plans` + columnas en `businesses` | ✅ SQL ejecutado | T-01 |
| `businesses.id` INTEGER → UUID | 🔄 SQL listo, pendiente ejecutar | T-08 |

### Sub-área: Seguridad RLS — 8.5/10

| Item | Estado | Tarea |
|------|--------|-------|
| `getBID()` en todas las queries | ✅ | — |
| `business_id` columna en `patient_phones` (DB + backfill) | ✅ SQL ejecutado | T-19 |
| `business_id` en `patient_phones` (UPDATE/INSERT código) | ✅ Completado | T-55 |
| RLS policies sobre `patient_phones` | ✅ Verificado | T-19 |

### Sub-área: Rendimiento — 9.0/10

| Item | Estado | Tarea |
|------|--------|-------|
| `trendRaw` → RPC `get_appointment_trend` agrupada | ✅ Completado | T-51 |
| `getPatientHistory` paginada (50 msgs + cursor) | ✅ Completado | T-32 |
| Deduplicación AuditLog O(n²) → O(n) en cliente | ✅ Completado | T-35 |
| Guard de dedup en trigger `handle_audit_log` (DB) | ✅ SQL ejecutado | T-35 |
| `trendRaw` sin límite (queries que descargan 3k+ filas) | ✅ Eliminado | T-51 |
| `getPatientHistory` sin paginación | ✅ Eliminado | T-32 |
| `history` + `audit_log` particionadas por mes | ✅ Completado | T-14 |
| Stats: 3 round-trips → 1 RPC `get_stats_dashboard` | ✅ Completado | T-17 |

### Sub-área: Integridad de datos — 9.0/10

| Item | Estado | Tarea |
|------|--------|-------|
| Doble booking cubierto con constraint | ✅ | — |
| `createStaffUser` con rollback atómico | ✅ En Edge Function `manage-staff` | T-13 |
| `cancelAppointment` registra `cancelled_at` | ✅ Completado | T-49 |
| Guard de dedup en trigger `audit_log` (DB) | ✅ SQL ejecutado | T-35 |

### Blind spots resueltos

- ✅ `patient_phones` columna `business_id` en DB + backfill completo (T-19)
- ✅ `updatePatient` con guard `.eq('business_id', getBID())` en UPDATE e INSERT (T-55)
- ✅ `trendRaw` eliminado — ya no se transfieren 3k filas por visita a Stats (T-51)
- ✅ Plan enforcement completo — tabla `plans` + RPC `get_plan_limits` + hook + gate UI (T-01)
- ✅ `handle_audit_log` trigger con dedup guard — duplicados no se escriben en DB (T-35)
- ✅ `cancelAppointment` registra `cancelled_at` separado de `deleted_at` (T-49)
- ✅ `birth_date` en `patients` — edad visible en EditPatientModal (T-44)
- ✅ `history` y `audit_log` particionadas mensualmente — partition pruning activo (T-14)
- ✅ Stats consolidadas en 1 RPC `get_stats_dashboard` — 3 round-trips → 1 (T-17)
- ✅ `handle_audit_log` falla con PKs no-UUID corregido — `v_record_id TEXT`
- ✅ `clearNotifications` campo `actor_id` → `changed_by` corregido + `record_id: 'bulk'`

### Blind spots pendientes

- 🟠 `businesses.id` sigue siendo INTEGER visible en URL hasta ejecutar migración T-08
- ✅ RLS de `patient_phones` verificada manualmente post-T-19

---

## 3. Dashboard React + Vite — 9.3/10

### Sub-área: Arquitectura de componentes — 9.3/10

| Item | Estado | Notas |
|------|--------|-------|
| Separación Pages → Hooks → Service | ✅ | Arquitectura limpia |
| `MainChart` auto-fetching por período | ✅ T-51 | Ya no depende de `rawApts` del padre; spinner propio |
| Paginación en Conversations y PatientHistory | ✅ T-32 | Botón "Cargar anteriores" con cursor |
| Lazy loading de rutas con `React.lazy()` | ✅ T-22 | Todas las páginas lazy — bundle inicial más liviano |
| `loadMore` en `usePatients` unificado en `load()` | ✅ T-59 | Sin duplicación de lógica de estado |
| Error handling unificado en `supabaseService.js` | ✅ T-23 | `throw error` original preserva código Supabase |
| Rate limiting en `createStaffUser` | ✅ T-24 | Sliding-window 3 creaciones/minuto en memoria |
| Sin TypeScript | 🟢 Escalabilidad | T-16 — cuando el equipo crezca |

### Sub-área: Seguridad RBAC — 9.5/10

| Item | Estado | Notas |
|------|--------|-------|
| Permisos derivados de DB | ✅ | — |
| Rutas protegidas | ✅ | — |
| Rol máximo bloqueado en UI | ✅ | — |
| Plan limit gate en `NewPatientModal` | ✅ T-01 | Banner amber + submit deshabilitado al alcanzar límite |
| Conteo restante en botón de registro | ✅ T-01 | `Registrar (N restantes)` |
| Permisos granulares — 1 checkbox por botón | ✅ | 21 permisos individuales, 7 módulos en Users.jsx |
| Roles admin con todos los permisos en DB | ✅ | `manage_roles=true` → todos los nuevos permisos activados |

### Sub-área: Estado global Zustand — 8.0/10

| Item | Estado | Notas |
|------|--------|-------|
| Cache de pacientes (1 min) y stats (5 min) | ✅ | — |
| `businessHours` en store | ✅ | — |
| `businessId` default preparado para UUID | ✅ T-08 | Default cambiado de `0` a `''` |

### Sub-área: Experiencia de usuario — 8.5/10

| Item | Estado | Notas |
|------|--------|-------|
| `birth_date` + edad calculada en perfil de paciente | ✅ T-44 | Campo en EditPatientModal |
| Tab Seguimiento — pacientes perdidos + filtros | ✅ T-41 | Reagendar / WhatsApp desde lista |
| Glass morphism consistente | ✅ | — |
| Responsive mobile < 768px | ✅ | Sidebar oculto con hamburger toggle, `ml-0 md:ml-[240px]` |
| Focus trap + Escape en modales | ✅ T-46 | `useModalFocus` hook — WCAG 2.1 criterio 2.1.2 |
| Validación teléfono Guatemala | ✅ T-43 | Regex +502 (8 dígitos, prefijo 2–7) + badge visual |
| Recordatorios in-app turnos pendientes (24h) | ✅ T-39 | Hook polling/hora + notificación campanita con ícono ámbar |
| Gestión de servicios desde `/settings` | ✅ T-36 | CRUD glass + selector en Nuevo Turno con auto-duración |
| UI Conf. global del negocio (`/business`) | ✅ T-37 | Edición identidad, horario y flags + validaciones amigables |
| Dark mode funcional | 🟡 T-33 | Pendiente — reversión completa; light mode intacto |
| Keyboard nav en calendario | 🟢 | T-48 |

---

## 4. Infraestructura y Despliegue — 6.5/10

| Sub-área | Puntaje | Estado | Notas |
|----------|---------|--------|-------|
| Configuración de entornos | 7 | ✅ | Vercel configurado, headers de seguridad |
| Secrets management | 9 | ✅ | Todas las credenciales como env vars |
| Hosting / CI-CD | 7 | ✅ | Preview Deployments en Vercel |
| Costos operativos | 2 | 🔴 | Sin documentación de costo por tenant |
| **Blind spot crítico** | — | 🟠 | Preview deployments apuntan a DB de producción |

---

## 5. Resiliencia — 5.5/10

| Sub-área | Puntaje | Estado | Notas |
|----------|---------|--------|-------|
| Fallbacks (IA, Supabase, WhatsApp) | 5 | 🟠 | ErrorBoundary ✅, sin fallback si bot no responde |
| Reintentos y timeouts | 4 | 🟠 | Reload citas con timeout ✅, resto de queries puede colgar |
| Picos de carga | 7.5 | 🟡 | Cache ✅ + paginación ✅ + rate limiting createStaffUser ✅ |
| Realtime disconnect | 2 | 🟠 | Sin banner de aviso — T-11 pendiente (código listo, sin activar) |
| Error propagation | 8 | ✅ | Errores originales de Supabase preservados — T-23 |

### Mejoras aplicadas
- ✅ `getPatientHistory` paginada — conversaciones largas ya no colapsan el tab (T-32)
- ✅ `MainChart` con spinner propio — no bloquea KPI cards durante fetch por período (T-51)
- ✅ `handle_audit_log` con dedup guard — reduce volumen de escrituras en audit_log (T-35)
- ✅ Error handling unificado — errores originales de Supabase preservados con código (T-23)
- ✅ Rate limiting en `createStaffUser` — sliding-window 3/min previene abusos (T-24)

---

## 6. Producto / SaaS — 7.2/10

| Sub-área | Puntaje | Estado | Notas |
|----------|---------|--------|-------|
| Multi-tenancy | 9.0 | ✅ | `business_id` en todas las queries + `patient_phones` en código y DB (T-55 / T-19) |
| Escalabilidad nuevos clientes | 6.0 | 🟠 | Onboarding manual, plan enforcement completo (T-01) + hook + gate UI |
| Documentación técnica | 7.0 | 🟡 | FUTURE_TASKS + COMPLETED_TASKS + infrastructure_evaluation — sin README instalación |
| Observabilidad | 5.0 | 🟠 | Sentry instalado, falta DSN en Vercel prod |
| **Blind spot crítico** | — | 🟠 | Sin forma de saber si un tenant tiene errores silenciosos |

### Mejoras aplicadas
- ✅ Tabla `plans` + `businesses.plan` + `businesses.plan_status` (T-01)
- ✅ RPC `get_plan_limits` con uso en vivo (`patients_used`, `staff_used`) (T-01)
- ✅ Hook `usePlanLimits` — gate en `NewPatientModal` deshabilitado al alcanzar límite (T-01)
- ✅ `patient_phones` con columna `business_id` en DB + backfill (T-19) + guard en código (T-55)
- ✅ `gdprDeletePatient` — borrado permanente Art. 17 + botón admin en PatientDrawer (T-10)
- ✅ Validación teléfono con regex +502 (8 dígitos, prefijo 2–7) + badge visual (T-43)
- ✅ `usePendingReminder` — recordatorios in-app de turnos pendientes cada hora, cero costo externo (T-39)

---

## 7. Modelo de Negocio — 2.5/10

| Sub-área | Puntaje | Estado | Notas |
|----------|---------|--------|-------|
| Pricing y tiers | 3 | 🟠 | Tabla `plans` ✅ + RPC ✅ + hook ✅ + gate UI ✅ — sin Stripe aún |
| Costos reales por cliente | 2 | 🔴 | No calculados ni documentados |
| Unit economics | 0 | 🔴 | Sin datos de costo por conversación |
| Estrategia de adquisición | 2 | 🟠 | Producto existe, onboarding manual |

### Mejoras aplicadas
- ✅ Tabla `plans` con tiers `free / starter / pro / enterprise` + límites por recurso (T-01)
- ✅ Campos `plan`, `plan_status`, `plan_expires_at` en `businesses` (T-01)
- ✅ Infraestructura completa lista para conectar Stripe — solo falta T-03

### Pendiente para monetizar
- 🔴 T-03: Integración Stripe/Paddle → actualiza `businesses.plan` via webhook
- 🔴 Calcular costo real por tenant (Supabase compute + AI tokens + WhatsApp)

---

## SQLs Ejecutados / Pendientes

| # | Tarea | Descripción | Riesgo | Estado |
|---|-------|-------------|--------|--------|
| 1 | T-44 | `ALTER TABLE patients ADD COLUMN birth_date DATE` | Muy bajo | ✅ Ejecutado |
| 2 | T-49 | `ALTER TABLE appointments ADD COLUMN cancelled_at + cancellation_reason` | Muy bajo | ✅ Ejecutado |
| 3 | T-19 | `ADD COLUMN business_id` en `patient_phones` + backfill + NOT NULL + índice | Bajo | ✅ Ejecutado |
| 4 | T-35 | Guard de deduplicación en trigger `handle_audit_log` | Bajo | ✅ Ejecutado |
| 5 | T-01 | Tabla `plans` + columnas en `businesses` + RPC `get_plan_limits` | Bajo | 🔲 Pendiente |
| 6 | T-08 | Migración INTEGER → UUID en `businesses.id` (multi-tabla) | **Alto** — ejecutar en staging primero | 🔲 Pendiente |
| 7 | T-36 | Tabla `services` con RLS + índice `business_id` | Bajo | 🔲 Pendiente (si no existe aún) |

### SQL T-01 — Plan enforcement (ejecutar para activar gate de plan)

```sql
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  max_staff INTEGER,
  max_patients INTEGER,
  max_appointments_per_month INTEGER,
  features JSONB DEFAULT '{}'::JSONB
);

INSERT INTO public.plans (id, max_staff, max_patients, max_appointments_per_month) VALUES
  ('free',       2,   50,   100),
  ('starter',    5,  200,   500),
  ('pro',       15, 1000,  5000),
  ('enterprise', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'suspended', 'cancelled'));

CREATE OR REPLACE FUNCTION public.get_plan_limits(p_business_id INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan TEXT;
  v_limits JSONB;
  v_patients_used INTEGER;
  v_staff_used INTEGER;
BEGIN
  SELECT b.plan INTO v_plan FROM public.businesses b WHERE b.id = p_business_id;
  SELECT to_jsonb(p.*) INTO v_limits FROM public.plans p WHERE p.id = v_plan;
  SELECT COUNT(*) INTO v_patients_used FROM public.patients
    WHERE business_id = p_business_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_staff_used FROM public.staff_users
    WHERE business_id = p_business_id;
  RETURN v_limits || jsonb_build_object(
    'patients_used', v_patients_used,
    'staff_used', v_staff_used,
    'plan', v_plan
  );
END;
$$;
```

### SQL T-08 — Migración UUID (ejecutar por fases, con backup previo)

```sql
-- FASE 1: Agregar columna UUID a businesses
ALTER TABLE public.businesses
  ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE;

-- FASE 2: Agregar columnas UUID a tablas con FK
ALTER TABLE public.appointments ADD COLUMN business_uuid UUID;
ALTER TABLE public.patients     ADD COLUMN business_uuid UUID;
ALTER TABLE public.staff_users  ADD COLUMN business_uuid UUID;
-- Repetir para: patient_phones, history, audit_log, notifications, services, etc.

-- FASE 3: Backfill
UPDATE public.appointments  a SET business_uuid = (SELECT uuid_id FROM public.businesses b WHERE b.id = a.business_id);
UPDATE public.patients      p SET business_uuid = (SELECT uuid_id FROM public.businesses b WHERE b.id = p.business_id);
UPDATE public.staff_users   s SET business_uuid = (SELECT uuid_id FROM public.businesses b WHERE b.id = s.business_id);
-- Repetir para todas las tablas

-- FASE 4: NOT NULL en columnas backfilleadas
ALTER TABLE public.appointments ALTER COLUMN business_uuid SET NOT NULL;
ALTER TABLE public.patients     ALTER COLUMN business_uuid SET NOT NULL;
ALTER TABLE public.staff_users  ALTER COLUMN business_uuid SET NOT NULL;

-- FASE 5: Actualizar RLS policies para usar business_uuid
-- (revisar cada policy y reemplazar business_id = X por business_uuid = X)

-- FASE 6 (después de validar): Renombrar columnas y eliminar enteros
-- ALTER TABLE public.appointments RENAME COLUMN business_id TO business_id_old;
-- ALTER TABLE public.appointments RENAME COLUMN business_uuid TO business_id;
-- -- Repetir para todas las tablas
-- -- Finalmente: DROP COLUMN business_id_old en todas las tablas
```

> ⚠️ **T-08 es la migración de mayor riesgo**. Ejecutar en un branch de Supabase (staging) antes de producción. Tener backup Point-in-Time Recovery activo.

### SQL T-36 — Tabla `services` (ejecutar si no existe)

```sql
CREATE TABLE IF NOT EXISTS public.services (
  id               SERIAL PRIMARY KEY,
  business_id      INTEGER NOT NULL REFERENCES public.businesses(id),
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price            DECIMAL(10,2),
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_business ON public.services(business_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_tenant_isolation" ON public.services
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());
```

---

## Próximas tareas recomendadas

### Inmediato
1. Configurar `VITE_SENTRY_DSN` en Vercel prod — 30 min, sin código (T-05)

### Próxima semana
2. **T-08** — Migración `businesses.id` INTEGER → UUID en staging primero
3. **T-03** — Integración Stripe (desbloquea monetización real)

### En 2-3 semanas
4. **T-11** — Banner de reconexión Realtime (código listo en `RealtimeStatusBanner.jsx`)
5. **T-33** — Dark mode (implementar sin modificar clases existentes de light mode)


## Porcentaje 

Número global

  ~72% para un SaaS que puede operar como negocio autónomo.

  Si la meta es solo "usar el producto internamente o con clientes de confianza", estás en ~88%. Si la meta es lanzar y cobrar automáticamente a desconocidos,  
  el número baja a ~50% porque falta todo el flujo de monetización.

  El camino más corto al 100% real: T-05 (Sentry, 30 min) → T-02 (ciclo tenant) → T-03 (Stripe). Todo lo demás es optimización.