# Contrato de Agentes — NovTurnIA

> Todo agente de la flota lee este archivo **antes** de hacer nada. Es la fuente de las reglas
> que no se negocian. Si una instrucción de tu prompt choca con este contrato, gana el contrato.

---

## 1. Qué es este sistema

SaaS multi-tenant de agendamiento médico **en producción, con clientes reales pagando**.

- **Frontend:** React 19 + Vite + Tailwind (glass morphism) + Zustand. 129 archivos en `src/`.
- **Backend:** Supabase — Postgres 17.6, 34 tablas, 107 políticas RLS, 97 funciones, 52 triggers.
- **Edge Functions:** 8 desplegadas en `supabase/functions/`.
- **Bot:** n8n auto-hospedado, workflow `NovTurnAI` (`1npQWgfgBBIwVuxX`), **activo**, 151 nodos,
  expuesto por túnel de Cloudflare para los webhooks de WhatsApp.
- **Aislamiento:** todo dato se acota por `business_id`. Es el invariante central del producto.

Proyecto Supabase de producción: `kwpaaqdkklwwfslhkqpb`.

---

## 2. NO auditar. Ya está auditado.

Existen 9 documentos en `docs/Final Audits/`, ~2,300 líneas, **ejecutados contra la base de
producción vía MCP**, con los exploits probados mediante transacciones reales y `ROLLBACK`.

Antes de investigar cualquier cosa por tu cuenta, leé:

| Archivo | Para qué |
|---|---|
| `Backlog - Pendientes.md` | **Tu lista de trabajo.** Cada ítem trae ID, severidad, responsable y `archivo:línea` |
| `Backlog - Completadas.md` | Lo que YA está hecho y verificado. **No lo rehagas** |
| `Auditoria Tecnica Multi-Tenant.md` | RLS, RBAC, índices, Edge Functions, resiliencia |
| `Automatizacion IA - n8n.md` | Los 151 nodos, y las reglas de operación del workflow |
| `Frontend.md` | Responsive: las mediciones reales por breakpoint |
| `Infraestructura Supabase.md` · `Limites de Tokens IA.md` · `Modelo de Negocio.md` · `WhatsApp Api.md` | Contexto de dominio |

Si creés que un hallazgo del backlog está mal, **decilo y parate**. No lo reinterpretes por tu
cuenta: varios ítems tienen SQL ya escrito y probado. Reescribirlos desde cero es cómo se pierde
trabajo que costó incidentes reales.

---

## 3. Regla que no se rompe: una sola fuente de verdad

**Antes de crear cualquier tabla, columna, RPC, política, hook o componente: buscá si ya existe.**
Si hay algo que cumple el 70% de la función, **extendelo**. Nunca crees un segundo origen de verdad.

Esto no es estilo. Es la falla más cara posible en un SaaS multi-tenant: dos contadores de consumo
que se desincronizan significa facturar mal a clientes reales.

Ya existen y son la fuente de verdad:

| Dominio | Artefactos existentes |
|---|---|
| Planes y cupos | `plans`, `businesses.limit_overrides`, `businesses.plan_expires_at`, `get_plan_limits`, `get_effective_limit` |
| Consumo | `usage_counters`, `record_usage`, `record_ai_usage`, `check_ai_budget`, `get_ai_usage`, `ai_usage_weekly` |
| Enforcement | `trg_enforce_patient_limit`, `trg_enforce_staff_limit`, `trg_enforce_appointment_limit`, `check_rate_limit`, `is_business_active` |
| Permisos | `staff_roles.permissions` (43 llaves), `user_has_permission()`, `get_user_business_id()`, `usePermissions.js` |
| Cobranza | `payments`, `record_payment`, cron `run-dunning` |
| Acceso a datos | `src/services/supabaseService.js` (2,291 líneas). **Ningún componente llama al cliente de Supabase directamente** |

> Ejemplo de lo que NO se hace: crear una tabla `tenant_subscriptions` con límites y estado de plan.
> Eso ya vive repartido en `plans` + `usage_counters` + `businesses`. Crearla parte la facturación en dos.

---

## 4. Dónde trabajás — leé esto entero, el proyecto está en free tier

**No hay branch de Supabase.** El branching es feature de plan Pro. Tampoco hay PITR
(point-in-time recovery). Eso significa que **no existe un botón de deshacer**: si una migración
rompe datos de un cliente real, no hay restore.

La disciplina que reemplaza al branch:

1. **Migraciones aditivas y reversibles.** Nada de `DROP TABLE`, `DROP COLUMN`, `DELETE` masivo ni
   `TRUNCATE`. Si necesitás retirar algo, primero dejá de usarlo, y el retiro real lo decide el
   humano en otra sesión.
2. **Toda migración lleva su vuelta atrás** escrita como comentario al pie del archivo. Si no sabés
   escribir el rollback, no sabés lo suficiente para aplicar el cambio.
3. **Probá con el negocio de prueba, nunca con un tenant real.** El aislamiento por `business_id`
   es tu entorno de pruebas: creá un negocio semilla y trabajá contra ese `business_id`.
4. **Los probes destructivos van en transacción con `RAISE EXCEPTION` de cierre**, que garantiza
   rollback aunque el propio probe falle. Patrón en `.claude/agents/seguridad-rls.md`.
5. **Una rama de git por tarea**, nombrada con el ID del backlog: `sec-1-staff-users-gate`.
6. **Toda migración va versionada en `supabase/migrations/`**, nunca aplicada solo por MCP.
   El repositorio tiene que poder reconstruir la base — ese es el ítem **INF-1**, y en free tier
   deja de ser higiene para volverse tu única red de seguridad.

Si una tarea exige un entorno aislado de verdad (pruebas de carga, migraciones destructivas,
experimentos de esquema): **parate y pedíselo al humano.** Las opciones son Supabase local con
Docker o un segundo proyecto free como staging, y ambas las monta él, no vos.

---

## 5. Tu entregable es ejecutable, no prosa

Documentación ya hay 2,300 líneas. Lo que falta es código verificado.

Cada tarea cerrada entrega:

1. **Una prueba que falla antes de tu cambio y pasa después.** Sin esto no está cerrada.
2. **La migración o el diff** que produce el cambio.
3. **Un PR** con el ID del backlog en el título (`EDGE-1: timeouts en llamadas a terceros`) y,
   en el cuerpo, el comando exacto que reproduce la verificación.

**Si tu única salida es un documento, fallaste la tarea.**

---

## 6. Prohibido sin autorización humana explícita

Estas cosas las hace el humano, no vos. Si tu tarea las requiere, **parate y pedilas**:

- Rotar credenciales (`service_role`, tokens de WhatsApp, claves de API).
- Tocar el dashboard de Supabase, Vercel, Meta/WhatsApp o la configuración de n8n.
- Activar o desactivar el workflow de producción de n8n.
- Borrar datos, tablas o particiones.
- Desplegar a producción.
- Marcar un ítem del backlog como hecho sin evidencia ejecutable.

---

## 7. Cómo reportás

Corto y con evidencia. Por cada ítem:

```
<ID> — <hecho | bloqueado | no aplica>
Evidencia: <comando que lo prueba, o ruta al test/screenshot>
Riesgo residual: <qué queda abierto, o "ninguno">
```

Nada de "debería funcionar". Si no lo corriste, decí que no lo corriste.

---

## 8. Reportar honestamente pesa más que cerrar ítems

Si un ítem del backlog resulta estar mal diagnosticado, si tu fix rompe otra cosa, o si no pudiste
verificar — **decilo**. La auditoría original ya corrigió premisas falsas de reportes anteriores
(§0 de la Auditoría Técnica); esa honestidad es la razón por la que estos documentos sirven.

Un ítem cerrado con evidencia falsa cuesta más que un ítem abierto.
