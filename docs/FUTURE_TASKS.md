# NovTurnAI — Tareas Pendientes & Plan de Ejecución

> Actualizado: 2026-04-16 (sesión 13)
> Prioridades: 🔴 Pre-lanzamiento · 🟠 Primer mes · 🟡 Segundo mes · 🟢 Escalabilidad
> Estado: 🔲 Pendiente · 🔄 En progreso · 🚫 Bloqueada por dependencia
> Completadas → ver [COMPLETED_TASKS.md](./COMPLETED_TASKS.md)

---

## Resumen Ejecutivo

| Fase | Tareas | Bloqueante para |
|------|--------|----------------|
| 🔴 Pre-lanzamiento | 1 | Cobrar, operar y lanzar sin riesgos críticos |
| 🟠 Primer mes | 2 | Visibilidad en producción, features clave |
| 🟡 Segundo mes | 3 | Compliance médico, resiliencia, calidad de datos |
| 🟢 Escalabilidad | 3 | Crecimiento a 10k+ usuarios |
| Técnicas de apoyo | 1 | Sin ventana fija, soportan las demás |

---

## FASE 1 — 🔴 Pre-lanzamiento (bloqueantes absolutos)

### T-03 🔴 Billing integration — Stripe/Paddle actualiza `businesses.plan` 🔲

**Problema:** No hay integración con ningún proveedor de pagos. El campo `plan` en `businesses` se actualizaría manualmente. No hay forma automatizada de cobrar ni de actualizar el plan tras un pago.

**Solución:**

1. **Edge Function `stripe-webhook`:**
```typescript
// supabase/functions/stripe-webhook/index.ts
switch (event.type) {
  case 'checkout.session.completed':
    await supabase.from('businesses')
      .update({ plan: planId, plan_status: 'active', plan_expires_at: expiresAt })
      .eq('stripe_customer_id', event.data.object.customer);
    break;
  case 'invoice.payment_failed':
    // → plan_status = 'suspended'
    break;
  case 'customer.subscription.deleted':
    // → plan_status = 'cancelled'
    break;
}
```

2. **Campo `stripe_customer_id`** en `businesses`.

3. **Edge Function `create-checkout`** que cree la sesión de Stripe y redirija.

4. **Página `/billing`**: plan actual, fecha de renovación, historial via Stripe Customer Portal.

**Esfuerzo:** Alto
**Depende de:** T-01, T-02

---

## FASE 2 — 🟠 Primer mes (necesario para operar en producción)

### T-05 🟠 Error tracking — Sentry 🔲

**Problema:** Sin visibilidad de errores en producción. Los errores aparecen solo en `console.error` sin alertas, sin contexto del usuario ni del tenant afectado. Si la app explota en producción para un cliente, nadie lo sabe.

**Solución:**
```js
// main.jsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Redactar PII: emails, teléfonos de pacientes
    return event;
  }
});
// En useAuth.js al login:
Sentry.setUser({ id: user.id, business_id: profile.business_id });
```

**Esfuerzo:** Bajo-Medio (1-2 días incluyendo configuración de alertas)

---


### T-08 🟠 Migrar `businesses.id` de INTEGER a UUID 🔲

**Problema:** El ID de tenant es un entero secuencial (`1`, `2`, `3`) visible en la URL `?bid=1`. Permite enumerar cuántos clientes tiene el SaaS y en qué orden se registraron — información sensible competitivamente.

**Plan de migración (requiere T-09 — staging):**
```sql
-- Fase 1: agregar columna UUID
ALTER TABLE public.businesses ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid() NOT NULL;
-- Fase 2: columnas uuid en tablas con FK (appointments, patients, staff_users, etc.)
-- Fase 3: backfill
-- Fase 4: NOT NULL, FKs nuevas, eliminar columnas enteras
-- Fase 5: actualizar RLS policies
-- Fase 6: frontend lee UUID en lugar de INTEGER
```

**Esfuerzo:** Alto (migración multi-tabla + frontend + validar RLS)
**Depende de:** T-09 ✅ (CI/CD ya configurado)

---



## FASE 3 — 🟡 Segundo mes (compliance médico y resiliencia)

### T-10-b 🟡 Política de retención de datos automática (pg_cron) 🔲


**Problema:** No hay política definida para datos de pacientes. En muchos países los datos médicos tienen requisitos legales de retención mínima (ej: 5 años) Y eliminación segura a petición del paciente. Sin esto el SaaS no puede operar legalmente en mercados regulados.

**Solución:**
1. **Tabla `data_retention_policies`** por negocio con períodos configurables.
2. **pg_cron job** diario que purgue datos cuyo `deleted_at` supera el período de retención configurado.
3. **Endpoint "Eliminar mis datos"** (GDPR Art. 17) que marque al paciente para borrado inmediato.
4. Revisar si hay archivos en Supabase Storage que también necesiten purga.

**Esfuerzo:** Medio

---

### T-11 🟡 Reconexión automática de Realtime con aviso al usuario 🔲

**Problema:** Si la conexión WebSocket de Supabase se cae, los datos del calendario quedan desactualizados sin ningún aviso visual.

**Estado actual:** Código implementado pero desactivado — `RealtimeStatusBanner.jsx` y `realtimeStatus` en el store están listos. El bloqueo es que el evento `CLOSED` de Supabase Realtime se dispara tanto en desconexiones reales como cuando un canal se desmonta por navegación. Los módulos sin realtime (Stats, Users) nunca cancelan el timer, haciendo que el banner aparezca en falso.

**Pendiente investigar:** Cómo distinguir un `CLOSED` por navegación de uno por desconexión real. Opciones:
1. Escuchar `window.navigator.onLine` + evento `offline` del navegador en lugar del callback del canal
2. Usar un canal global de larga vida (en App.jsx) en lugar de canales por página
3. Heartbeat manual con ping periódico a Supabase

**Archivos listos para activar:** `RealtimeStatusBanner.jsx`, `useAppStore.realtimeStatus/setRealtimeStatus`, comentario en `useRealtime.js`.

---

### T-33 🟡 Dark mode funcional 🔲

**Problema:** El store ya tiene `theme` / `setTheme` y el Topbar define `themeOptions`, pero el menú solo muestra "Cerrar Sesión". Nada aplica la clase `dark` al DOM. El selector de tema está 100% muerto.

**Solución:**
- `tailwind.config.js`: activar `darkMode: 'class'`.
- `App.jsx`: `useEffect` que aplica/remueve `dark` en `document.documentElement` según el store. Para `system`, escuchar `matchMedia('prefers-color-scheme: dark')`.
- `index.css`: reglas `.dark body`, `.dark body::before`, `.dark .glass-premium`, `.dark .glass-morphism`, `.dark .glass-input` — **sin modificar ninguna regla de light mode**.
- `Topbar.jsx`: opciones Claro / Oscuro / Predeterminado con check en la activa. `dark:` en contenedores del panel y menú.
- `Sidebar.jsx`: `dark:` en los 4 strings de NavLink y footer.

> ⚠️ Restricción crítica: no modificar ninguna clase existente del light mode. Agregar `dark:` solo como adición, nunca como reemplazo.

**Esfuerzo:** Medio

---





## FASE 4 — 🟢 Escalabilidad (cuando el volumen lo requiera)

### T-15 🟢 TanStack Query — cache coherente y menos boilerplate 🔲

**Cuándo actuar:** Cuando haya 3+ desarrolladores o al agregar TypeScript (T-16).

**Problema:** Cada hook reimplementa manualmente loading state, error handling, caching y stale detection. ~60% del código de hooks es boilerplate idéntico que hay que mantener en paralelo.

**Solución:**
```js
const { data, isLoading, error } = useQuery({
  queryKey: ['patients', businessId, search],
  queryFn: () => getPatients(businessId, search),
  staleTime: 1000 * 60 * 2
});
```
Beneficios: cache automático, deduplicación, retry, window focus refetch.

**Esfuerzo:** Alto (refactor de todos los hooks, pero valor enorme a largo plazo)

---

### T-16 🟢 TypeScript — migración gradual 🔲

**Cuándo actuar:** Al agregar TanStack Query (T-15) o cuando el equipo crezca.

**Orden de migración:**
1. `supabaseService.js` → `.ts` con tipos generados por Supabase
2. Stores Zustand
3. Hooks
4. Componentes (última prioridad)

```bash
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

**Esfuerzo:** Alto (progresivo, no necesita hacerse de golpe)

---






**Problema:** El calendario no tiene atajos de teclado para navegar entre fechas. Los usuarios que prefieren el teclado (o personas con movilidad reducida) no pueden cambiar de día/semana sin el mouse. Esto viola WCAG 2.1 criterio 2.1.1.

**Solución:**
- `←` / `→` para día anterior / siguiente
- `Alt+←` / `Alt+→` para semana anterior / siguiente
- `T` para ir a hoy (today)
- Implementar con `useEffect` + `document.addEventListener('keydown', ...)` en el componente del calendario

**Esfuerzo:** Bajo

---

## Tareas Técnicas de Apoyo (sin fase fija)

| ID | Tarea | Prioridad | Depende de | Esfuerzo | Estado |
|----|-------|-----------|------------|---------|--------|
| T-18 | Migrar `appointments.id` a UUID v7 (cuando supere 50k filas) | 🟢 | T-09 | Medio | 🔲 |

---

## Orden de ejecución recomendado


```
✅ T-09 (CI/CD + Branch)        ← COMPLETADO
✅ T-21 (Error boundary)        ← COMPLETADO
✅ T-27 (Password mínimo 8)     ← COMPLETADO
✅ T-28 (createPatient atómico) ← COMPLETADO — RPC en producción
✅ T-29 (queries al service)    ← COMPLETADO
✅ T-30 (AuditLog optimizado)   ← COMPLETADO
✅ T-20 (BUSINESS_ID al store)  ← COMPLETADO
✅ T-06 (Onboarding tenants)    ← COMPLETADO
✅ T-31 (Conversations liviana) ← COMPLETADO
✅ T-34 (isEditableRole por DB) ← COMPLETADO
✅ T-50 (COUNT mensajes + mes)  ← COMPLETADO
✅ T-52 (handoff_at servidor)   ← COMPLETADO
✅ T-53 (setAuth user/profile)  ← COMPLETADO
✅ T-57 (useRealtime genérico)  ← COMPLETADO
✅ T-58 (getRange memoizado)    ← COMPLETADO
✅ T-38 (TIME_SLOTS dinámicos) ← COMPLETADO — Calendar + modales + getBusinessSchedule
✅ T-47 (Cache stats → Realtime) ← COMPLETADO
✅ T-56 (clearNotifications audit) ← COMPLETADO
✅ T-60 (unificar business queries) ← COMPLETADO
✅ T-61 (fetchBusinessStatus → service) ← COMPLETADO
✅ T-62 (catch rethrow vacío) ← COMPLETADO
✅ Bug: prop mutation AppointmentDrawer ← COMPLETADO
✅ Bug: alert() → showErrorToast ← COMPLETADO
✅ Bug: toISO null guard ← COMPLETADO
✅ Bug: parseInt radix CalendarWeek/Day ← COMPLETADO
✅ Bug: try/catch debounce NewAppointmentModal ← COMPLETADO
✅ T-41 (no-shows + tab Seguimiento)           ← COMPLETADO
✅ T-51 (trendRaw → RPC agrupada)             ← COMPLETADO — elimina 3k filas por carga
✅ T-01 (Plan enforcement)                    ← COMPLETADO — tabla plans + hook + gate UI
✅ T-13 (createStaffUser atómico)             ← COMPLETADO — ya estaba en Edge Function
✅ T-32 (getPatientHistory paginada)          ← COMPLETADO — cursor + UI "cargar anteriores"
✅ T-35 (AuditLog dedup O(n) + trigger)       ← COMPLETADO — JS + SQL trigger guard
✅ T-44 (birth_date en patients)              ← COMPLETADO — DB + UI edad calculada
✅ T-49 (cancelled_at en appointments)        ← COMPLETADO — DB + código cancelación
✅ T-55 (phones sin business_id)              ← COMPLETADO — guard en updatePatient
✅ T-19 (business_id en patient_phones)       ← COMPLETADO — columna + índice + backfill
✅ T-22 (lazy loading de rutas)               ← COMPLETADO — React.lazy() + Suspense
✅ Fix gráfica MainChart (RPC fallback)       ← COMPLETADO — PGRST202 fallback a query directa
✅ T-43 (validación teléfono)                ← COMPLETADO — regex +502 (8 dígitos, prefijo 2–7) + badge
✅ T-46 (focus trap + Escape)                ← COMPLETADO — useModalFocus en 4 modales
✅ T-17 (get_stats_dashboard RPC)            ← COMPLETADO — 3 queries → 1 round-trip
✅ T-23 (error handling supabaseService)     ← COMPLETADO — throw error original, clearNotifications fixed
✅ T-24 (rate limiting createStaffUser)      ← COMPLETADO — sliding-window 3/min en memoria
✅ T-59 (loadMore unificado)                 ← COMPLETADO — delega en load()
✅ T-14 (particionamiento history+audit_log) ← COMPLETADO — mensual desde 2026-03, DEFAULT partition
🔲 T-11 (banner Realtime)                    ← PENDIENTE — código listo, sin activar (ver task)
✅ T-10 (GDPR borrado permanente)            ← COMPLETADO — gdprDeletePatient + botón admin
✅ T-54 (activePatients bug)                 ← COMPLETADO — ya corregido en useStats.js
✅ T-45 (audit trail permisos)               ← COMPLETADO — trigger SQL en staff_roles
✅ T-39 (Recordatorios turnos pendientes)    ← COMPLETADO — hook polling cada hora + notificación campanita
✅ T-36 (Gestión de servicios dashboard)    ← COMPLETADO — /settings + CRUD glass + selector en Nuevo Turno
✅ T-37 (UI Conf. global del negocio)        ← COMPLETADO — UI /settings/business + validaciones
    ↓
T-05 (Sentry)                   ← Visibilidad desde el día 1 en prod
    ↓
T-02 (Ciclo de vida tenant)     ← Depende de T-01 ✅
T-03 (Billing — Stripe)         ← Depende de T-01 ✅ + T-02
    ↓
T-08 (businesses.id → UUID)     ← CI/CD ya está ✅, frontend preparado ✅
    ↓
T-39 (Recordatorios)
    ↓
T-10-b (Retención automática pg_cron)
T-11 (Reconexión Realtime)      ← T-57 ya hecho ✅
    ↓
T-14, T-15, T-16                ← Escalabilidad: cuando el volumen lo pida
T-36, T-48               ← Features + UX adicional
```

## Deployment
- Vercel (ya lo tienes)
- Es la opción ideal para este stack. Lo que te permite hacer cambios en producción de forma segura:
  - Preview Deployments — cada PR o branch genera una URL única (proyecto-git-feature-x.vercel.app). Puedes testear en "producción real" antes de mergear a main.
  - Rollbacks — si algo rompe, vuelves a la versión anterior en segundos.
  - Integración con Supabase — funciona perfecto con el sistema de variables de entorno y el dashboard de Supabase.
