// supabase/functions/manage-staff/index.ts
// Edge Function: Staff user management (create, delete, update-role)
// Auth: Supabase JWT via Authorization header (supabase.functions.invoke passes it automatically)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/auth.ts';

// ── Verify caller and load their staff profile ───────────────────────────────
async function getCallerProfile(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('staff_users')
    .select('id, business_id, role_id, staff_roles(permissions)')
    .eq('id', user.id)
    .eq('active', true)
    .single();

  return profile ?? null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método no permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Authenticate ─────────────────────────────────────────────────────────
    const caller = await getCallerProfile(req);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'No autorizado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check manage_users permission ─────────────────────────────────────────
    const permissions = (caller.staff_roles as any)?.permissions ?? {};
    if (!permissions?.manage_users) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos para gestionar usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'create':      return await handleCreate(caller, payload);
      case 'delete':      return await handleDelete(caller, payload);
      case 'update-role': return await handleUpdateRole(caller, payload);
      default:
        return new Response(
          JSON.stringify({ error: `Acción no reconocida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (err) {
    console.error('manage-staff error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Create Staff User ─────────────────────────────────────────────────────────
// T-26 fix: usar auth.admin.createUser() en lugar de INSERT directo con campo password
async function handleCreate(
  caller: { business_id: string },
  payload: Record<string, unknown>
): Promise<Response> {
  const { email, password, full_name, role_id } = payload;

  if (!email || typeof email !== 'string') {
    return new Response(
      JSON.stringify({ error: 'El email es requerido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!password || typeof password !== 'string' || (password as string).length < 8) {
    return new Response(
      JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email as string)) {
    return new Response(
      JSON.stringify({ error: 'El formato de email es inválido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Crear en auth.users (email_confirm: true = sin email de verificación)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: (email as string).trim().toLowerCase(),
    password: password as string,
    email_confirm: true,
  });

  if (authError) {
    const isDuplicate = authError.message?.toLowerCase().includes('already') ||
                        authError.message?.toLowerCase().includes('exists');
    return new Response(
      JSON.stringify({ error: isDuplicate ? 'Ya existe un usuario con ese email.' : authError.message }),
      { status: isDuplicate ? 409 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Insertar en staff_users (sin campo password — no existe en la tabla)
  const { data, error: insertError } = await supabaseAdmin
    .from('staff_users')
    .insert({
      id: authData.user.id,
      email: (email as string).trim().toLowerCase(),
      full_name: (full_name as string) || (email as string),
      role_id: role_id ?? null,
      business_id: caller.business_id,
      active: true,
    })
    .select('*, staff_roles(*)')
    .single();

  if (insertError) {
    // Rollback: eliminar el auth user si falla el insert
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw insertError;
  }

  return new Response(
    JSON.stringify({ data }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── Delete Staff User ─────────────────────────────────────────────────────────
// T-04 fix: soft-delete en staff_users + hard-delete en auth.users
async function handleDelete(
  caller: { id: string; business_id: string },
  payload: Record<string, unknown>
): Promise<Response> {
  const { id } = payload;

  if (!id || typeof id !== 'string') {
    return new Response(
      JSON.stringify({ error: 'El ID del usuario es requerido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevenir auto-eliminación
  if (id === caller.id) {
    return new Response(
      JSON.stringify({ error: 'No puede eliminarse a sí mismo.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Verificar que el usuario pertenece al mismo negocio
  const { data: target } = await supabaseAdmin
    .from('staff_users')
    .select('id')
    .eq('id', id)
    .eq('business_id', caller.business_id)
    .single();

  if (!target) {
    return new Response(
      JSON.stringify({ error: 'Usuario no encontrado en este negocio.' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Soft-delete en staff_users (preserva historial de turnos/auditoría)
  await supabaseAdmin
    .from('staff_users')
    .update({ active: false })
    .eq('id', id)
    .eq('business_id', caller.business_id);

  // 3. Hard-delete en auth.users (elimina credenciales — ya no puede autenticarse)
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id as string);
  if (authDeleteError) {
    console.error('auth.admin.deleteUser failed:', authDeleteError.message);
    // No lanzar — el soft-delete ya fue aplicado, el usuario no puede operar
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── Update Staff Role ─────────────────────────────────────────────────────────
async function handleUpdateRole(
  caller: { business_id: string },
  payload: Record<string, unknown>
): Promise<Response> {
  const { userId, roleId } = payload;

  if (!userId || !roleId) {
    return new Response(
      JSON.stringify({ error: 'userId y roleId son requeridos.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabaseAdmin
    .from('staff_users')
    .update({ role_id: roleId })
    .eq('id', userId)
    .eq('business_id', caller.business_id);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
