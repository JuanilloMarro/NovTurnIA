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

  return user.email === SUPER_ADMIN_EMAIL;
}

// ── Permisos por defecto para cada rol ────────────────────────────────────
const OWNER_PERMISSIONS = {
  view_stats: true,
  manage_users: true,
  manage_roles: true,
  create_appointments: true,
  edit_appointments: true,
  confirm_appointments: true,
  delete_appointments: true,
  view_patients: true,
  create_patients: true,
  edit_patients: true,
  delete_patients: true,
  view_conversations: true,
  toggle_ai: true,
  delete_users: true,
};

const SECRETARY_PERMISSIONS = {
  view_stats: false,
  manage_users: false,
  manage_roles: false,
  create_appointments: true,
  edit_appointments: true,
  confirm_appointments: true,
  delete_appointments: false,
  view_patients: true,
  create_patients: true,
  edit_patients: true,
  delete_patients: false,
  view_conversations: true,
  toggle_ai: false,
  delete_users: false,
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
      plan = 'starter',
      timezone = 'America/Guatemala',
      schedule_start = '09:00',
      schedule_end = '18:00',
      schedule_days = [1, 2, 3, 4, 5], // Lun–Vie
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

    // ── PASO 1: Crear el negocio ─────────────────────────────────────────────
    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .insert({
        name: business_name,
        plan,
        plan_status: 'active',
        timezone,
        schedule_start,
        schedule_end,
        schedule_days,
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
