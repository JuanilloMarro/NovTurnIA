// supabase/functions/onboard-tenant/index.ts
// T-06: Onboarding automatizado de tenants
//
// Crea un nuevo negocio (business) con su admin de forma atómica:
//   1. INSERT businesses → obtiene business_id
//   2. INSERT staff_roles (owner + secretary por defecto)
//   3. auth.admin.createUser con el email del admin
//   4. INSERT staff_users con rol owner
//   5. Rollback completo si cualquier paso falla
//
// Auth: solo el super-admin puede llamar este endpoint.
// El super-admin se identifica por SUPER_ADMIN_EMAIL en las variables de entorno.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/auth.ts';

const SUPER_ADMIN_EMAIL = Deno.env.get('SUPER_ADMIN_EMAIL') ?? '';

// ── Verificar que el caller es el super-admin ──────────────────────────────
async function getSuperAdminCaller(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  // Fuente de verdad: app_super_admins por user_id (mismo patrón que admin-list-businesses).
  const { data: adminRow } = await supabaseAdmin
    .from('app_super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminRow) return true;

  // Respaldo: secret SUPER_ADMIN_EMAIL (puede no estar seteado).
  return !!SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL;
}

// ── Permisos por defecto para cada rol ────────────────────────────────────
// IMPORTANTE: estas llaves deben coincidir 1:1 con el vocabulario de
// src/hooks/usePermissions.js (fuente de verdad del front). Bug corregido 2026-07-04:
// el set anterior omitía ~20 llaves reales (reschedule, servicios, ofertas, finanzas,
// reply_conversations, etc.) → un owner recién creado encontraba medio dashboard bloqueado.
const OWNER_PERMISSIONS = {
  // Turnos
  create_appointments: true, edit_appointments: true, reschedule_appointments: true,
  confirm_appointments: true, set_pending_appointments: true, mark_noshow_appointments: true,
  delete_appointments: true, purge_appointments: true,
  // Seguimiento
  view_followup: true,
  // Pipeline CRM
  view_pipeline: true,
  // Pacientes
  view_patients: true, create_patients: true, edit_patients: true,
  delete_patients: true, export_patients: true,
  // Conversaciones e IA
  view_conversations: true, toggle_ai: true, reply_conversations: true,
  clear_conversations: true, delete_conversations: true,
  // Estadísticas
  view_stats: true,
  // Servicios
  create_services: true, edit_services: true, toggle_services: true, delete_services: true,
  // Ofertas
  create_offers: true, edit_offers: true, toggle_offers: true, delete_offers: true,
  // Finanzas
  view_finance: true, confirm_delivery: true, record_income: true, record_expense: true,
  manage_supplies: true, void_finance: true, manage_finance_categories: true,
  manage_cash: true, pay_commission: true, manage_finance_settings: true,
  // Centro de IA
  use_ai_hub: true,
  // Administración
  manage_roles: true, delete_users: true, export_reports: true,
};

const SECRETARY_PERMISSIONS = {
  // Turnos (opera el día a día, sin borrar)
  create_appointments: true, edit_appointments: true, reschedule_appointments: true,
  confirm_appointments: true, set_pending_appointments: true, mark_noshow_appointments: true,
  delete_appointments: false, purge_appointments: false,
  // Seguimiento
  view_followup: true,
  // Pipeline CRM
  view_pipeline: true,
  // Pacientes
  view_patients: true, create_patients: true, edit_patients: true,
  delete_patients: false, export_patients: false,
  // Conversaciones e IA
  view_conversations: true, toggle_ai: false, reply_conversations: true,
  clear_conversations: false, delete_conversations: false,
  // Estadísticas
  view_stats: false,
  // Servicios
  create_services: false, edit_services: false, toggle_services: false, delete_services: false,
  // Ofertas
  create_offers: false, edit_offers: false, toggle_offers: false, delete_offers: false,
  // Finanzas
  view_finance: false, confirm_delivery: false, record_income: false, record_expense: false,
  manage_supplies: false, void_finance: false, manage_finance_categories: false,
  manage_cash: false, pay_commission: false, manage_finance_settings: false,
  // Centro de IA
  use_ai_hub: false,
  // Administración
  manage_roles: false, delete_users: false, export_reports: false,
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── Auth: solo super-admin ───────────────────────────────────────────────
  const isSuperAdmin = await getSuperAdminCaller(req);
  if (!isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: 'No autorizado. Solo el super-admin puede crear tenants.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Solo se rastrea el usuario de auth: es lo ÚNICO que puede quedar suelto,
  // porque las 3 escrituras de Postgres viven en una transacción que se revierte sola.
  let createdAuthUserId: string | null = null;

  try {
    const {
      business_name,
      admin_email,
      admin_name,
      admin_password,
      plan = 'basic',
      timezone = 'America/Guatemala',
      schedule_start = 9,
      schedule_end = 18,
      schedule_days = [1, 2, 3, 4, 5], // Lun–Vie
      phone_number_id = '',
      whatsapp_token = '',
      trial = false, // true → plan_status 'trial' con vencimiento a 14 días (el cron run-dunning lo vence solo)
    } = await req.json();

    // ── Validaciones ────────────────────────────────────────────────────────
    if (!business_name || !admin_email || !admin_password) {
      return new Response(
        JSON.stringify({ error: 'business_name, admin_email y admin_password son requeridos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (admin_password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'La contraseña del admin debe tener al menos 8 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PASO 0.5: Obtener el plan_id ────────────────────────────────────────
    const { data: planRecord, error: planError } = await (supabaseAdmin as any)
      .from('plans')
      .select('id')
      .eq('tier', plan)
      .single();

    if (planError || !planRecord) {
      return new Response(
        JSON.stringify({ error: `Plan '${plan}' no existe.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Normalización al esquema real de `businesses` ───────────────────────
    // schedule_start/end: columna INTEGER (hora 0-23); el form manda "HH:MM".
    // schedule_days:      columna VARCHAR ("Lun,Mar,…"); el form manda [0..6] (0=Dom).
    // phone_number_id / whatsapp_token: columnas NOT NULL sin default → mínimo ''.
    const toHour = (v: unknown): number => {
      if (typeof v === 'number') return Math.trunc(v);
      const n = parseInt(String(v ?? '').split(':')[0], 10);
      return Number.isFinite(n) ? n : 0;
    };
    const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const toScheduleDays = (v: unknown): string =>
      Array.isArray(v)
        ? v.map((d) => DAY_LABELS[Number(d)]).filter(Boolean).join(',')
        : (typeof v === 'string' && v.trim() ? v : 'Lun,Mar,Mié,Jue,Vie');

    // ── B5: fecha de vencimiento del plan ────────────────────────────────────
    // Antes el alta de PAGO se creaba con `plan_expires_at: null` y el cron
    // `run-dunning` vence por fecha — o sea que un cliente que pagaba nunca
    // entraba al ciclo de cobranza: no se le vencía el plan jamás. El trial sí
    // tenía fecha, así que el bug afectaba solo a los que pagan.
    //
    // Un mes calendario con `setMonth`, no 30 días fijos: es el mismo criterio
    // que usa `record_payment` al extender +1 mes cuando se marca pagado, y así
    // el alta y la renovación no se desincronizan.
    //
    // Salvedad conocida de `setMonth`: si el alta cae un 31 y el mes siguiente
    // no tiene 31 días, se desborda al mes de después (31-ene → 3-mar, medido).
    // Se deja así a propósito — el desborde juega a favor del cliente y
    // corregirlo a "último día del mes" desalinearía el alta de `record_payment`,
    // que tiene el mismo comportamiento.
    const planExpiresAt = (() => {
      const d = new Date();
      if (trial) d.setDate(d.getDate() + 14);
      else d.setMonth(d.getMonth() + 1);
      return d.toISOString();
    })();

    // ── RES-2 · Alta atómica ─────────────────────────────────────────────────
    // Antes eran 4 escrituras sueltas (businesses → staff_roles → auth → staff_users)
    // compensadas a mano en el catch, con las dos compensaciones silenciadas por
    // `.catch(() => {})`. Si la compensación fallaba también, quedaba un usuario en
    // `auth.users` sin `staff_users`: login exitoso, dashboard vacío y el email
    // tomado, así que el cliente no podía siquiera reintentar el alta.
    //
    // Ahora hay UN solo paso que puede dejar rastro (auth) y UNA transacción que
    // hace el resto. El orden importa: auth va PRIMERO justamente porque es el
    // único que no puede vivir dentro de la transacción de Postgres — si falla,
    // no hay nada que compensar.

    // ── PASO 1: usuario en auth.users (fuera de Postgres, por eso va primero) ──
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email.trim().toLowerCase(),
      password: admin_password,
      email_confirm: true,
    });

    if (authError) {
      const isDuplicate = authError.message?.toLowerCase().includes('already') ||
                          authError.message?.toLowerCase().includes('exists');
      throw new Error(isDuplicate
        ? `Ya existe un usuario con el email ${admin_email}.`
        : `Error creando usuario: ${authError.message}`
      );
    }
    createdAuthUserId = authData.user.id;

    // ── PASO 2: negocio + roles + staff_users, en UNA transacción ─────────────
    // Los permisos viajan como parámetro y no viven en el SQL: son ~40 llaves por
    // rol y duplicarlos en la migración crearía dos fuentes de verdad que se
    // desincronizan con el primer permiso nuevo.
    // `planExpiresAt` también se manda calculado desde acá — ver la nota de arriba
    // sobre `setMonth`: resolverlo en SQL con `interval '1 month'` cambiaría el
    // vencimiento de las altas del día 31.
    const { data: newBusinessId, error: rpcError } = await (supabaseAdmin as any).rpc(
      'provision_tenant',
      {
        p_user_id: authData.user.id,
        p_business_name: business_name,
        p_plan_id: planRecord.id,
        p_trial: !!trial,
        p_plan_expires_at: planExpiresAt,
        p_timezone: timezone,
        p_schedule_start: toHour(schedule_start),
        p_schedule_end: toHour(schedule_end),
        p_schedule_days: toScheduleDays(schedule_days),
        p_phone_number_id: phone_number_id ?? '',
        p_whatsapp_token: whatsapp_token ?? '',
        p_owner_permissions: OWNER_PERMISSIONS,
        p_secretary_permissions: SECRETARY_PERMISSIONS,
        p_owner_name: admin_name || admin_email,
        p_owner_email: admin_email.trim().toLowerCase(),
      }
    );

    if (rpcError) throw new Error(`Error provisionando el negocio: ${rpcError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        business_id: newBusinessId,
        admin_user_id: authData.user.id,
        message: `Tenant "${business_name}" creado correctamente.`,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('onboard-tenant error:', err);

    // ── Compensación ─────────────────────────────────────────────────────────
    // Solo queda UN caso posible: auth creado y la RPC falló. La transacción ya
    // garantiza que no quedó nada en Postgres, así que basta con borrar el usuario.
    //
    // Y si ESTE borrado falla, ya no se traga el error: se deja un log explícito
    // con el id huérfano. Antes iba a `.catch(() => {})` y el estado inconsistente
    // —usuario sin negocio, email tomado— quedaba invisible para todos.
    let compensacionFallida: string | null = null;
    if (createdAuthUserId) {
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      if (delError) {
        compensacionFallida = createdAuthUserId;
        console.error(
          `onboard-tenant: NO se pudo borrar el usuario huérfano ${createdAuthUserId} ` +
          `(${admin_email ?? 'email desconocido'}): ${delError.message}. ` +
          `Ese email queda tomado y hay que borrarlo a mano en Auth.`
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: (err as Error).message || 'Error interno del servidor.',
        // Se le dice al super-admin qué quedó sucio, en vez de dejarlo adivinar
        // por qué el email "ya existe" en el siguiente intento.
        ...(compensacionFallida
          ? { orphan_auth_user_id: compensacionFallida, warning: 'El usuario de Auth no pudo borrarse; ese email queda tomado hasta eliminarlo a mano.' }
          : {}),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
