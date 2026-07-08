# Runbook — Alta de Negocios (Tenants)

> **Fecha:** 2026-07-04. Aplica a `onboard-tenant` **v10+**.

## Flujo normal: 100% desde el dashboard ✅

**No necesitas crear nada manualmente en Supabase.** El flujo completo (usuario de auth + negocio + roles + staff) lo hace la Edge Function:

1. Inicia sesión como super-admin (`noviumgt@gmail.com` — debe existir en `app_super_admins`, que es la fuente de verdad por `user_id`).
2. `/admin` → botón **"+ Nuevo negocio"** → llena el formulario (nombre, plan, horario, email y contraseña temporal del admin del negocio; WhatsApp opcional).
3. **"Crear tenant"** → la Edge Function `onboard-tenant` ejecuta atómicamente:
   - `INSERT businesses` (normaliza horas `"09:00"`→`9`, días `[1..5]`→`"Lun,…,Vie"`, WhatsApp `''` si vacío)
   - `INSERT staff_roles` × 2 (owner + secretary con permisos por defecto)
   - `auth.admin.createUser` (email confirmado, sin email de invitación)
   - `INSERT staff_users` (id = uuid del auth user, rol owner)
   - Rollback completo si cualquier paso falla.
4. Éxito → toast con `business_id` y `admin_user_id`. El admin del negocio ya puede iniciar sesión con el email/contraseña temporal.

### Troubleshooting rápido

| Síntoma | Causa | Fix |
|---|---|---|
| **403** "No autorizado" | Tu `user_id` no está en `app_super_admins` (o v9 desplegada — regresión corregida en v10) | `INSERT INTO app_super_admins (user_id, email) VALUES ('<uuid>', '<email>');` — sin redeploy |
| **500** "Error creando negocio" | Drift form ↔ esquema de `businesses` | Ver logs de la función; los 3 casos conocidos (horas, días, WhatsApp NOT NULL) ya están normalizados en v10 |
| **500** "Ya existe un usuario con el email…" | Email repetido en `auth.users` | Usar otro email o borrar el usuario previo en Studio |
| **Se queda cargando sin error** (y en logs del servidor no aparece el POST) | **Navigator lock de gotrue atascado** en el navegador (pestañas zombis / StrictMode) — `functions.invoke` se colgaba antes de enviar. Corregido 2026-07-05: `adminService.js` usa fetch directo + timeout, error claro en ≤30s | Cerrar TODAS las pestañas del dashboard, abrir una sola y reintentar. Con el fix ya no puede colgarse indefinidamente |
| ¿Puedo dejar Phone Number ID y Token vacíos? | Sí — son opcionales al crear; la función inserta `''` y se configuran después en AdminPanel → tab "Horario + IA" | N/A |

## Plan B: alta manual (solo si la Edge Function no estuviera disponible)

En **Supabase Studio**:

1. **Auth → Users → Add user**: email + contraseña, marca *Auto Confirm*. Copia el **UUID** generado.
2. **SQL Editor** (ajusta valores):

```sql
-- 1) Negocio (phone_number_id/whatsapp_token son NOT NULL: usa '' si aún no hay)
INSERT INTO businesses (name, plan_id, plan_status, timezone,
                        schedule_start, schedule_end, schedule_days,
                        phone_number_id, whatsapp_token)
VALUES ('Clínica Demo',
        (SELECT id FROM plans WHERE tier = 'pro'),
        'active', 'America/Guatemala', 9, 18, 'Lun,Mar,Mié,Jue,Vie', '', '')
RETURNING id;  -- ← guarda este business_id

-- 2) Roles por defecto
INSERT INTO staff_roles (business_id, name, permissions) VALUES
('<business_id>', 'owner',
 '{"view_stats":true,"manage_users":true,"manage_roles":true,"create_appointments":true,"edit_appointments":true,"confirm_appointments":true,"delete_appointments":true,"view_patients":true,"create_patients":true,"edit_patients":true,"delete_patients":true,"view_conversations":true,"toggle_ai":true,"delete_users":true}'),
('<business_id>', 'secretary',
 '{"view_stats":false,"manage_users":false,"manage_roles":false,"create_appointments":true,"edit_appointments":true,"confirm_appointments":true,"delete_appointments":false,"view_patients":true,"create_patients":true,"edit_patients":true,"delete_patients":false,"view_conversations":true,"toggle_ai":false,"delete_users":false}');

-- 3) Staff owner (id = UUID del auth user del paso 1)
INSERT INTO staff_users (id, business_id, email, full_name, role_id, active)
VALUES ('<uuid-auth-user>', '<business_id>', 'admin@clinica.com', 'Dr. Demo',
        (SELECT id FROM staff_roles WHERE business_id = '<business_id>' AND name = 'owner'),
        true);
```

3. Verifica: login con ese email en la app → debe entrar directo al dashboard de su negocio.

> Nota: el orden importa (negocio → roles → auth user → staff). Si algo falla a medias, borra en orden inverso; el `DELETE` de `businesses` arrastra roles/staff por FK CASCADE.
