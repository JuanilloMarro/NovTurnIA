# NovTurnAI — Evaluación de Estado

> Versión: 1.2 · Fecha: 2026-04-29
> Escala 0–10 · 🔴 Bloqueante · 🟠 Importante · 🟡 Deseable · ✅ Resuelto

---

## Resumen Ejecutivo

| Área                        | Puntaje  | Tendencia |
|-----------------------------|----------|-----------|
| Base de datos (Supabase)    | 9.7/10   | ↑ BD-01 a BD-08 resueltos |
| Dashboard React + Vite      | 9.0/10   | Estable   |
| Bot / N8N Workflow          | 9.5/10   | Estable   |
| Infraestructura / Despliegue| 8.0/10   | Estable   |
| Producto / SaaS             | 8.7/10   | Estable   |
| Resiliencia                 | 7.2/10   | Estable   |
| Modelo de negocio           | 6.5/10   | ↑ Plans + costos definidos, falta Stripe |
| **PROMEDIO GLOBAL**         | **8.7/10** |         |

**Estado:** Apto para producción con clientes controlados. Para cobro automático falta Stripe (T-03).

---

## 1. Base de Datos (Supabase) — 9.7/10

> Auditoría vía Supabase MCP (advisors security + performance, pg_policies, pg_proc, pg_triggers, cron.job). BD-01 a BD-04, BD-06 a BD-08 resueltos.

### Puntaje desglosado

| Sub-área                       | Puntaje | Notas |
|--------------------------------|---------|-------|
| 1.1 Estructura y normalización | 9.5     | UUID multi-tabla, particiones mensuales |
| 1.2 Seguridad RLS              | 9.5     | `api_rate_limits` bloqueada para `anon`/`authenticated` |
| 1.3 SECURITY DEFINER hygiene   | 9.0     | 10 RPCs admin/triggers sin acceso desde cliente |
| 1.4 Rendimiento e índices      | 9.8     | Índice `notifications.appointment_id` creado |
| 1.5 Integridad y triggers      | 9.5     | EXCLUDE constraint anti-doble-booking, audit + notify + validate |
| 1.6 Automatización (pg_cron)   | 9.5     | Jobs duplicados y stale eliminados |
| 1.7 Edge Functions             | 9.0     | Ambas con `verify_jwt`, `manage-staff` v3 con rollback atómico |
| 1.8 Auth hardening             | 8.5     | HIBP leaked-password protection deshabilitado (toggle manual) |
| 1.9 Extensions schema          | 9.5     | `btree_gist` y `pg_trgm` movidas a `extensions` schema |

---

### 1.1 Tablas (`public`) — 12 lógicas + 16 particiones

| Tabla              | RLS | Filas | Función |
|--------------------|-----|-------|---------|
| `businesses`       | ✅  | 4     | Tenant raíz (UUID PK) |
| `plans`            | ✅  | 4     | Tiers free/starter/pro/enterprise |
| `staff_roles`      | ✅  | 8     | Permisos granulares (21 flags) por rol |
| `staff_users`      | ✅  | 7     | Usuarios del dashboard |
| `patients`         | ✅  | 29    | Pacientes (soft delete vía `deleted_at`) |
| `patient_phones`   | ✅  | 24    | Teléfonos N:1 paciente |
| `services`         | ✅  | 20    | Catálogo servicios + duración |
| `appointments`     | ✅  | 29    | Turnos (EXCLUDE constraint anti-doble-booking) |
| `notifications`    | ✅  | 27    | Bell del dashboard |
| `message_buffer`   | ✅  | 0     | Cola N8N entre mensajes WhatsApp |
| `api_rate_limits`  | ✅  | 39    | Sliding-window de `check_rate_limit()` — acceso solo vía SECURITY DEFINER |
| `history`          | ✅  | 0     | Padre particionado mensual (24 + 112 filas en 2026m03/m04) |
| `audit_log`        | ✅  | 0     | Padre particionado mensual (104 + 346 filas en 2026m03/m04) |

Particiones creadas hasta `2026m10` + `_default`. Job semanal `ensure_future_partitions(6)` mantiene 6 meses adelantados.

---

### 1.2 RLS Policies — patrón unificado `business_id = get_user_business_id()`

| Tabla              | SELECT | INSERT | UPDATE | DELETE | Notas |
|--------------------|:------:|:------:|:------:|:------:|-------|
| `appointments`     | ✅ | ✅ | ✅ | — | DELETE bloqueado, se usa soft-cancel |
| `patients`         | ✅ | ✅ | ✅ | ✅ | DELETE solo para GDPR Art. 17 |
| `patient_phones`   | ✅ | ✅ | ✅ | — | |
| `services`         | ✅ | ✅ | ✅ | ✅ | |
| `staff_users`      | ✅ | ✅ | ✅ | — | DELETE vía Edge Function |
| `staff_roles`      | ✅ | — | ✅ | — | INSERT/DELETE bloqueados (catálogo fijo) |
| `notifications`    | ✅ | ✅ | ✅ | ✅ | |
| `message_buffer`   | ✅ | ✅ | — | ✅ | UPDATE no necesario |
| `history` (todas)  | ✅ | ✅ | — | — | Append-only |
| `audit_log` (todas)| ✅ | ✅ | — | — | Append-only + retención 90d |
| `businesses`       | ✅ | — | ✅ | — | INSERT vía Edge Function `onboard-tenant` |
| `plans`            | ✅ | — | — | — | Lectura pública (catálogo) |
| `api_rate_limits`  | ✅ | ✅ | ✅ | ✅ | Solo accesible vía `check_rate_limit()` — `REVOKE ALL` para `anon`/`authenticated` |

---

### 1.3 RPCs (PL/pgSQL en `public`)

#### Helpers RLS (uso interno, OK como SECURITY DEFINER)
| Función | Propósito |
|---------|-----------|
| `get_user_business_id()` | Devuelve `business_id` del JWT — pivote de toda la RLS |
| `get_my_business_id()` | Idem, alias usado por algunas RPCs |
| `is_business_active()` | Gate de suspensión/cancelación de plan |

#### Lecturas de dashboard
| Función | Propósito |
|---------|-----------|
| `get_stats_dashboard(month_start, month_end)` | KPIs en 1 round-trip (3→1) |
| `get_appointment_trend(biz, granularity, start, end)` | Gráfico tendencia agrupada |
| `get_business_stats()`, `get_patient_stats()` | Agregados generales |
| `get_available_slots(biz, date, duration)` | Slots libres del calendario |
| `get_patient_appointments(biz, patient)` | Historial de un paciente |
| `get_plan_limits(biz)` | Límites + uso vivo (`patients_used`, `staff_used`) |

#### Escrituras transaccionales
| Función | Propósito |
|---------|-----------|
| `create_patient_with_phone(biz, name, phone)` | Paciente + teléfono atómico |
| `create_appointment(biz, patient, service, start, end)` | Cita validada |
| `reactivate_bot(patient_id)` | Quita `human_takeover` |
| `suspend_tenant(biz, status, reason)` | Ciclo de vida del cliente |
| `check_rate_limit(key, window)` | Sliding-window de N8N/staff |

#### Mantenimiento (solo invocables por `service_role`)
| Función | Propósito |
|---------|-----------|
| `create_monthly_partition(parent, date)` | Crea partición de un mes |
| `ensure_future_partitions(months_ahead)` | Mantiene N meses adelantados |
| `prevent_mass_delete()` | Trigger anti-borrado masivo (>50 filas) |
| `validate_appointment()` | Trigger BEFORE — valida fechas/servicio |
| `trigger_set_updated_at()` | Auto `updated_at` |
| `trigger_audit_log()`, `handle_audit_log()` | Escribe en `audit_log` particionado |
| `trigger_add_notification()`, `handle_new_staff_user()` | Notificaciones + alta de staff |

---

### 1.4 Índices y rendimiento

- ✅ Índices en todos los `business_id` (multi-tabla) — pivote RLS
- ✅ Índices `name_trgm` (pg_trgm) en `patients` para búsqueda fuzzy
- ✅ EXCLUDE GIST anti-doble-booking en `appointments` (requiere `btree_gist`)
- ✅ `notifications.appointment_id` — índice `idx_notifications_appointment_id` creado
- ✅ `btree_gist` y `pg_trgm` movidas a `extensions` schema
- ℹ️ ~25 índices "unused" reportados — son particiones futuras vacías (m05–m10), comportamiento esperado

---

### 1.5 Triggers activos

| Tabla         | Triggers |
|---------------|----------|
| `appointments`| `audit_appointments` (I/U/D), `notify_new_appointment` (I), `prevent_mass_cancel` (U), `validate_appointment` (BEFORE I/U), `set_updated_at` |
| `patients`    | `audit_patients` (I/U/D), `notify_patient_events` (I/U), `set_updated_at` |
| `staff_roles` | `trg_audit_staff_roles` (U) — audit trail de cambios de permisos, `set_updated_at` |
| `staff_users` | `set_updated_at` |
| `businesses`, `services` | `set_updated_at` |

---

### 1.6 pg_cron jobs

| Job | Schedule | Estado |
|-----|----------|--------|
| `clean-message-buffer` | `* * * * *` | ✅ |
| `retain-audit-log` | `0 9 * * *` | ✅ borra >90 días |
| `ensure-future-partitions` | `0 3 * * 0` | ✅ |

---

### 1.7 Edge Functions

| Slug | Versión | `verify_jwt` | Rol |
|------|:-------:|:------------:|-----|
| `manage-staff`   | v3 | ✅ | Alta/edit/baja staff con rollback atómico (Auth user + DB row) |
| `onboard-tenant` | v1 | ✅ | Crea `business` + primer `staff_user` |

---

### 1.8 Auth hardening

- ✅ Password mínimo 8 caracteres (T-27)
- ✅ JWT con `business_id` claim usado por todas las RLS
- 🟠 HIBP leaked-password protection deshabilitado — activar en Auth → Policies (1 toggle, pendiente manual)

---

### Pendientes de la BD para deploy

| ID    | Severidad | Acción | Estado |
|-------|-----------|--------|--------|
| BD-05 | 🟠 | Activar HIBP leaked-password protection en Auth → Policies (toggle manual en dashboard) | Pendiente |

**Veredicto BD:** Apta para producción. Solo queda BD-05 — toggle manual en el dashboard de Supabase.

---

## 2. Dashboard React + Vite — 9.0/10

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Arquitectura de componentes | 9.3   | ✅ |
| Seguridad RBAC            | 9.5     | ✅ |
| Estado global (Zustand)   | 8.0     | ✅ |
| Experiencia de usuario    | 8.5     | ✅ |

### Hechos clave
- Separación limpia: Pages → Hooks → Service
- Lazy loading en todas las rutas
- 21 permisos granulares por usuario
- Plan enforcement: gate en UI al alcanzar límite de pacientes/staff
- `useModalFocus` con focus trap + Escape (WCAG 2.1)
- Validación teléfono Guatemala (+502, 8 dígitos)
- Paginación en Conversations y PatientHistory

### Pendientes
- 🟠 `cache: 'no-store'` aplicado al cliente Supabase globalmente — anula HTTP cache en Storage y Auth innecesariamente. Mover a wrapper opt-in solo donde se necesite.
- 🟠 `sourcemap: false` en `vite.config.js` — stack traces en Sentry son ilegibles sin sourcemaps
- 🟡 26 `console.log/error/warn` en 18 archivos llegan a producción sin guard `import.meta.env.DEV`
- 🟡 `key={location.pathname}` en `<Suspense>` fuerza remount en cada navegación — fetch redundante
- 🟡 Sin ESLint configurado
- 🟡 Dark mode pendiente (reversión completa; light mode intacto)

---

## 3. Bot / N8N Workflow — 9.5/10

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Seguridad de credenciales | 8.0     | 🟢 |
| Manejo de errores         | 8.0     | 🟠 |
| Message buffering         | 10.0    | ✅ |
| Enrutamiento y flujo      | 9.0     | ✅ |
| Optimización de tokens IA | 9.5     | ✅ |

### Hechos clave
- N8N en Railway/Elestio, aislado del dashboard
- `message_buffer` con RLS SELECT + INSERT + DELETE
- Rate limiting habilitado: `Supabase Request API LR` + `Limit` + `Response API Limit Range`
- Truncado de historial (250 chars) + Flash-Lite pre-agente
- `human_takeover` funcional
- Validación anti-spam / insultos / emojis
- Sort historial por `created_at` (no por `id`)
- WhatsApp $0: usa solo ventana de 24hrs (cliente escribe primero, sin recordatorios salientes)

### Pendientes
- 🔴 Sin logging estructurado de fallos del bot hacia Supabase — errores técnicos mueren silenciosamente
- 🟠 Nodos `Add History` (×12) sin `onError` — fallos no manejados explícitamente

---

## 4. Infraestructura / Despliegue — 8.0/10

### Estado actual

| Sub-área                  | Puntaje | Estado |
|---------------------------|---------|--------|
| Secrets management        | 9.0     | ✅ |
| Hosting / CI-CD           | 8.0     | ✅ |
| Build / bundling          | 8.0     | ✅ |
| CSP / cabeceras           | 7.0     | 🟡 |
| Sourcemaps producción     | 5.0     | 🟠 |

### Hechos clave
- Vercel Free con headers de seguridad y CSP
- `manualChunks` (react / supabase / charts / sentry) + lazy routes
- Todas las credenciales como env vars, `.env` en `.gitignore`
- Sentry integrado en código (`main.jsx`) con redacción PII

### Pendientes
- 🟠 **`VITE_SENTRY_DSN` no configurado en Vercel prod** — código listo, falta la env var (5 min)
- 🟠 **Sourcemaps** — cambiar a `sourcemap: 'hidden'` + upload via Sentry CLI post-build
- 🟠 **Preview deployments apuntan a DB de producción** — configurar branch DB de Supabase en Vercel
- 🟡 CSP permite `'unsafe-inline'` en `script-src` y `style-src` (requerido por Vite/Tailwind)
- 🟡 `index.html` con cambios sin commit (preconnect Supabase + normalización tildes)

---

## 5. Producto / SaaS — 8.7/10

### Estado actual

| Sub-área                    | Puntaje | Estado |
|-----------------------------|---------|--------|
| Multi-tenancy               | 9.5     | ✅ |
| Escalabilidad nuevos clientes | 6.0   | 🟠 |
| Observabilidad por tenant   | 5.0     | 🟠 |
| Ciclo de vida del cliente   | 5.0     | 🟠 |

### Hechos clave
- `business_id` UUID en todas las queries + RLS — no enumerable en URL
- Plan enforcement completo (tabla `plans` + RPC + hook + gate UI)
- GDPR: `gdprDeletePatient` — borrado permanente Art. 17
- Onboarding actualmente manual

### Pendientes
- 🟠 Sin forma de detectar errores silenciosos por tenant
- 🟠 Onboarding sin flujo automatizado — quién crea el `business` y el primer `staff_user` en DB
- 🟠 Ciclo de vida: sin lógica de suspensión, reactivación ni offboarding automático

---

## 6. Resiliencia — 7.2/10

### Estado actual

| Sub-área              | Puntaje | Estado |
|-----------------------|---------|--------|
| Fallbacks             | 6.0     | 🟠 |
| Reintentos / timeouts | 5.0     | 🟠 |
| Picos de carga        | 9.0     | ✅ |
| Realtime disconnect   | 2.0     | 🟠 |
| Error propagation     | 8.0     | ✅ |

### Hechos clave
- `ErrorBoundary` activo
- Errores originales de Supabase preservados con código
- Rate limiting en `createStaffUser` (sliding-window 3/min)
- Cache de pacientes (1 min) y stats (5 min) en Zustand

### Pendientes
- 🟠 Sin banner de reconexión Realtime (código listo en `RealtimeStatusBanner.jsx` — sin activar)
- 🟠 Sin retry automático en fallos de Supabase o N8N

---

## 7. Modelo de Negocio — 6.5/10

### 7.1 Estructura de planes (definida en `PlansModal.jsx`)

| Plan       | Precio  | IA Model            | Usuarios | Mensajes/mes | Clientes |
|------------|---------|---------------------|----------|--------------|----------|
| Básico     | Q499    | Gemini 2.5 Flash Lite | 1      | 500          | 100      |
| Pro        | Q999    | Gemini 2.5 Flash    | 5        | 2,500        | 500      |
| Enterprise | Q1,999  | Gemini 2.5 Pro      | ∞        | Ilimitados   | ∞        |

### 7.2 Costos fijos mensuales (independientes del # clientes)

| Concepto       | Costo USD | Costo Q (a 7.65) |
|----------------|-----------|------------------|
| Supabase Pro   | $25       | Q191             |
| Elestio Pro N8N| $14       | Q107             |
| Vercel Pro     | $20       | Q153             |
| **TOTAL FIJO** | **$59**   | **~Q450**        |

### 7.3 Costo IA por cliente individual

| Plan       | Modelo Gemini       | $/cliente/mes | Q/cliente |
|------------|---------------------|---------------|-----------|
| Básico     | Flash Lite          | $0.006–0.009  | Q0.05–0.07|
| Pro        | Flash               | $0.020–0.031  | Q0.15–0.24|
| Enterprise | Pro                 | $0.084–0.127  | Q0.64–0.97|

### 7.4 Unit economics — margen por 1 cliente

| Plan       | Ingreso | Costo (fijo+IA) | Margen Q | Margen % |
|------------|---------|-----------------|----------|----------|
| Básico     | Q499    | ~Q450           | **Q49**  | **~10%** ⚠️ |
| Pro        | Q999    | ~Q450           | **Q549** | **~55%** ✅ |
| Enterprise | Q1,999  | ~Q451           | **Q1,548**| **~77%** ✅ |

> **Tu hipótesis "1 cliente cubre la mensualidad" es correcta sólo desde Pro hacia arriba.**
> Con 1 cliente Básico, el margen de Q49 lo come fácilmente: Stripe fee (~Q20) + 1 hora de soporte + 1 reembolso ocasional.

### 7.5 Escenarios de break-even y escala

| Cantidad clientes        | Ingreso mensual | Costo total | Margen | Margen % |
|--------------------------|-----------------|-------------|--------|----------|
| 1 Básico                 | Q499            | Q450        | Q49    | 10%      |
| 1 Pro                    | Q999            | Q450        | Q549   | 55%      |
| 5 Básico + 5 Pro         | Q7,490          | Q452        | Q7,038 | 94%      |
| 10 Pro                   | Q9,990          | Q452        | Q9,538 | 95%      |
| 100 Pro                  | Q99,900         | Q474        | Q99,426| 99%      |
| 1 Enterprise             | Q1,999          | Q451        | Q1,548 | 77%      |

### 7.6 Riesgos de costo NO contemplados en el Excel

| Riesgo | Impacto estimado |
|--------|------------------|
| 🔴 **WhatsApp templates salientes** (Enterprise dice "confirmaciones automáticas") | $0.03–0.13 por mensaje template fuera de ventana 24h. 100 confirmaciones/día = **$90–390/mes** por cliente Enterprise |
| 🟠 Stripe fees (3.4% + Q3 por txn) | Pro: ~Q37/mes; Enterprise: ~Q71/mes |
| 🟠 Soporte humano (no facturado) | 1h/cliente/mes ≈ Q50–100 de costo oportunidad |
| 🟠 Email transaccional (Resend) | $0 hasta 3K/mes; $20/mes después |
| 🟡 Dominio + SSL | ~$15/año (despreciable) |
| 🟡 Backups offsite extra | Supabase PITR add-on $10/mes (cuando crezca el data) |

### 7.7 Recomendaciones al modelo de negocio

#### 🔴 Prioridad alta

1. **Subir Básico a Q599 o reducir features.**
   El margen del 10% es insostenible. Propuesta:
   - **Opción A**: Subir a Q599 → margen 25% (más cómodo)
   - **Opción B**: Mantener Q499 pero quitar "Sincronización con Calendarios" e "Integración de Modulos a la Medida" (ambas requieren trabajo custom)

2. **Replantear "Confirmaciones automáticas" en Enterprise.**
   Si implica mensajes salientes WhatsApp fuera de 24h, **destruye el margen** (puede costar $90–390/mes/cliente). Opciones:
   - Limitar a X confirmaciones/mes incluidas, cobrar el resto como overage
   - Usar SMS Twilio o email en vez de WhatsApp template
   - Restringir a confirmaciones DENTRO de la ventana 24h (cuando el cliente ya escribió)

3. **"Página Web" en Enterprise — sacar como add-on.**
   Una web custom no es un feature de SaaS, es un proyecto. Cobrar setup fee Q3,000–5,000 separado o usar template estándar.

4. **Implementar T-03 Stripe.** Sin esto, el cobro manual limita escalabilidad real a ~10 clientes.

#### 🟠 Prioridad media

5. **Agregar plan TRIAL 14 días** del Pro completo. Reduce fricción de venta — estándar SaaS. Sin tarjeta para empezar (hooks: T-03 ya lo permite cuando esté).

6. **Onboarding fee opcional para Enterprise** (Q2,500–5,000 una vez). Cubre setup técnico + capacitación + customización. Mejora cashflow inicial.

7. **Anual con descuento**: 10 meses al precio de 12 (16% off). Mejora retention y LTV.

8. **Naming consistente de modelos IA**:
   - "Gemini 2.5 Flash Pro" no existe — es "Gemini 2.5 Pro" (sin "Flash")
   - Considerar ocultar el nombre técnico al cliente final ("IA Estándar / Avanzada / Premium")

#### 🟡 Mejoras estratégicas

9. **Analizar competencia local**:
   - Calendly: $10–20 USD = Q76–153 → tu Básico (Q499) está 3x arriba
   - Setmore: $0–12 USD = Q0–92 → idem
   - **Diferenciador**: WhatsApp en español + IA contextual + multi-tenant. Justifica el premium, pero comunícalo claro.

10. **Métricas a trackear desde día 1**:
    - MRR (Monthly Recurring Revenue)
    - Churn rate (% cancela/mes) — debajo del 5% mensual es bueno
    - LTV (Lifetime Value) — mínimo 3x CAC
    - CAC (Customer Acquisition Cost)

11. **Caso "1000 clientes" del Excel está sobreestimado en mensajes** (50–75K tokens/cliente/mes). Asegúrate de medir tokens reales en producción para ajustar tier de modelo.

### Pendientes (resumen)
- 🔴 **T-03 Stripe** — sin pagos automáticos, cobro manual limita escalabilidad
- 🔴 Recalcular costo de "Confirmaciones automáticas" Enterprise con escenario WhatsApp template
- 🟠 Subir Básico a Q599 o reducir alcance del plan
- 🟠 Sacar "Página Web" del plan Enterprise (vender como servicio aparte)
- 🟠 Definir trial 14 días + plan anual con descuento
- 🟡 Métricas SaaS (MRR/churn/LTV/CAC) sin instrumentar

---

## Checklist de Deployment

### Listo hoy
- [x] RLS en todas las tablas + `business_id` UUID
- [x] Plan enforcement (tabla + RPC + hook + gate UI)
- [x] Particionamiento `history` y `audit_log`
- [x] Lazy routes + chunks separados
- [x] Sentry integrado en código con redacción PII
- [x] ErrorBoundary, focus trap, paginación, rate limit
- [x] Edge Function `manage-staff` con rollback atómico
- [x] N8N con buffer + RLS + rate limiting tokens + WhatsApp $0

### Antes de prod abierta (🟠)
- [ ] Set `VITE_SENTRY_DSN` en Vercel prod — 5 min
- [ ] Sourcemaps `hidden` + upload a Sentry — 30 min
- [ ] Acotar `cache: 'no-store'` a wrapper opt-in — 1h
- [ ] Branch DB Supabase para Vercel previews — 30 min
- [ ] Commit `index.html` pendiente — 5 min

### Post-launch primer mes (🟡)
- [ ] T-03 Stripe (desbloquea cobro automático)
- [ ] T-11 Banner Realtime (código listo)
- [ ] Wrap `console.*` con `import.meta.env.DEV`
- [ ] ESLint config mínima
- [ ] Cleanup scripts SQL stale
- [ ] T-33 Dark mode
- [ ] Logging estructurado de errores del bot hacia Supabase

---

## Porcentaje global

- **~92%** para operar como negocio autónomo (planes definidos + costos calculados)
- **~96%** para uso interno o clientes de confianza
- **~75%** para lanzamiento público con cobro automático (falta Stripe + ajuste pricing Básico)

Camino más corto al 100%:
1. Hardening técnico: DSN Sentry → sourcemaps → no-store opt-in → branch DB preview **(≈3h)**
2. Negocio: subir Básico a Q599 o quitar features pesadas **(decisión, 0h)**
3. Quitar "Página Web" + "Confirmaciones automáticas" del Enterprise (o limitarlas) **(1h)**
4. T-03 Stripe + plan anual + trial 14 días **(~1 semana)**

---

## Apéndice — Resumen ejecutivo de tu hipótesis

> **"Con 1 cliente cubro toda mi mensualidad"**

| Plan | ¿Cubre $59 fijos? | Margen real |
|------|-------------------|-------------|
| 1 Básico Q499 | ✅ Apenas (Q49 sobra) | 10% — frágil |
| 1 Pro Q999    | ✅ Sí (Q549 sobra) | 55% — sano |
| 1 Enterprise Q1,999 | ✅ Sí (Q1,548 sobra) | 77% — excelente |

**Veredicto**: la hipótesis es cierta, pero **el Básico te deja sin colchón**. Apunta a que el MIX de clientes sea mayoritariamente Pro; el Básico debería usarse como gancho de entrada, no como producto principal.
