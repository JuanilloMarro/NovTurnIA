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

  let createdAuthUserId: string | null = null;
  let createdBusinessId: string | null = null;

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

    // ── PASO 1: Crear el negocio ─────────────────────────────────────────────
    const { data: business, error: bizError } = await (supabaseAdmin as any)
      .from('businesses')
      .insert({
        name: business_name,
        plan_id: planRecord.id,
        plan_status: 'active',
        timezone,
        schedule_start: toHour(schedule_start),
        schedule_end: toHour(schedule_end),
        schedule_days: toScheduleDays(schedule_days),
        phone_number_id: phone_number_id ?? '',
        whatsapp_token: whatsapp_token ?? '',
      })
      .select('id')
      .single();

    if (bizError) throw new Error(`Error creando negocio: ${bizError.message}`);
    createdBusinessId = business.id;

    // ── PASO 2: Crear roles por defecto ─────────────────────────────────────
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('staff_roles')
      .insert([
        { business_id: business.id, name: 'owner',     permissions: OWNER_PERMISSIONS },
        { business_id: business.id, name: 'secretary', permissions: SECRETARY_PERMISSIONS },
      ])
      .select('id, name');

    if (rolesError) throw new Error(`Error creando roles: ${rolesError.message}`);
    const ownerRole = roles.find((r: { name: string }) => r.name === 'owner');

    // ── PASO 3: Crear usuario en auth.users ─────────────────────────────────
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

    // ── PASO 4: Crear staff_users con rol owner ──────────────────────────────
    const { error: staffError } = await supabaseAdmin
      .from('staff_users')
      .insert({
        id: authData.user.id,
        business_id: business.id,
        email: admin_email.trim().toLowerCase(),
        full_name: admin_name || admin_email,
        role_id: ownerRole?.id ?? null,
        active: true,
      });

    if (staffError) throw new Error(`Error creando staff_users: ${staffError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        business_id: business.id,
        admin_user_id: authData.user.id,
        message: `Tenant "${business_name}" creado correctamente.`,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('onboard-tenant error:', err);

    // ── Rollback ─────────────────────────────────────────────────────────────
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
    }
    if (createdBusinessId) {
      // Cascade elimina staff_roles y staff_users si hay FK con ON DELETE CASCADE
      await supabaseAdmin.from('businesses').delete().eq('id', createdBusinessId).catch(() => {});
    }

    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Error interno del servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
