# Registro de Cambios: Reestructuración del Sistema de Planes y Seguridad (Abril 2026)

Este documento detalla todas las modificaciones arquitectónicas y limpiezas de código realizadas durante la sesión de refactorización del sistema de planes y manejo de tenants.

## 1. Aislamiento de Datos Multi-Tenant (Seguridad)
Se resolvió una vulnerabilidad donde cambiar de cuenta de negocio (`business_id`) mantenía información cacheada del usuario anterior.
- **`src/store/useAppStore.js`**: Se modificó `clearAuth()` para borrar explícitamente `_patientsCache`, `_conversationsCache`, `_statsCache` y el `humanTakeoverMap`.
- **`src/services/supabaseService.js`**: Se expuso `resetServiceCaches()` para resetear variables en memoria como `_businessTimezone`.
- **`src/hooks/useAuth.js`**: Se integró el reseteo de estos cachés tanto al desloguearse como en el listener global de cierre de sesión (`SIGNED_OUT`).

## 2. Refactorización de la Base de Datos (Sistema de Planes)
Se creó la migración **`008_plans_restructure.sql`** para abandonar los planes hardcodeados en texto y migrar a un modelo relacional escalable.
- **Tipos ENUM**: Se crearon `plan_tier` (`basic`, `pro`, `enterprise`) y `plan_status_enum`.
- **Tabla `plans`**: Se recreó con una llave primaria `UUID`, asegurando mapear estrictamente los límites que usa el frontend: `monthly_price`, `max_patients`, `max_staff` y un `JSONB` de `features`.
- **Relación con `businesses`**: Se agregó `plan_id` (FK a `plans`) y se migró toda la data existente de los negocios en vivo. La columna de texto vieja se renombró a `plan_legacy`.
- **RPC `get_plan_limits`**: Se reescribió la función de PostgreSQL para hacer un `JOIN` dinámico entre `businesses` y `plans`, devolviendo el límite exacto del tenant y el conteo en tiempo real de pacientes y staff usados.

## 3. Adaptación Transparente del Backend al Frontend
Para cumplir el requerimiento de **no tocar el código de UI** (`PlansModal.jsx`, `AdminOnboarding.jsx`, etc.):
- **`src/services/supabaseService.js`**: Se actualizó `getBusinessInfo()` para que ejecute un JOIN a la tabla de planes: `select('..., plans(id, tier, name, ...)')`. Internamente hace `data.plan = data.plans?.tier` para que el frontend siga creyendo que el plan es un simple string y ningún componente se rompa.
- **Consultas Limpias**: Se evitaron extraer columnas innecesarias (`annual_discount`, `max_appointments`) para evitar errores `400 Bad Request` en producción (Vercel).

## 4. Edge Functions
- **`supabase/functions/onboard-tenant/index.ts`**: Al momento de crear un nuevo negocio, la función ahora lee el string (ej. `'basic'`), busca automáticamente su `UUID` en la tabla `plans` y lo inserta en `businesses.plan_id`. Se agregó `(supabaseAdmin as any)` para suprimir errores de validación de TypeScript locales.

## 5. Limpieza del Entorno y UX
- **Limpieza de "Skills"**: Se eliminaron decenas de carpetas ocultas (`.claude`, `.agents`, `.windsurf`, etc.) generadas por herramientas de IA que contaminaban el control de versiones. Todas las reglas de Supabase se centralizaron exclusivamente en la carpeta `skills/`.
- **`index.html`**: Se solucionó la advertencia de obsolescencia en consola añadiendo la meta etiqueta estándar `<meta name="mobile-web-app-capable" content="yes" />` para la PWA, manteniendo la retrocompatibilidad con iOS.

---
**Próximos Pasos Recomendados:**
1. Desplegar los cambios del edge function con: `supabase functions deploy onboard-tenant`.
2. Cuando el frontend legacy eventualmente migre, se puede eliminar la columna `plan_legacy` de la tabla `businesses`.
