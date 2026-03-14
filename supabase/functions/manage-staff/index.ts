// supabase/functions/manage-staff/index.ts
// Edge Function: Staff user management (create, delete, change role)
// Only accessible by users with manage_users permission

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin, getStaffSession } from '../_shared/auth.ts';

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

    // ── Authenticate ─────────────────────────────────
    const session = await getStaffSession(req);
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'No autorizado. Inicie sesión nuevamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check manage_users permission ────────────────
    if (!session.permissions?.manage_users) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos para gestionar usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...payload } = await req.json();

    // ── Route by action ──────────────────────────────
    switch (action) {
      case 'create':
        return await handleCreate(session, payload);
      case 'delete':
        return await handleDelete(session, payload);
      case 'update-role':
        return await handleUpdateRole(session, payload);
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

// ── Create Staff User ────────────────────────────────
async function handleCreate(
  session: { business_id: number },
  payload: Record<string, unknown>
): Promise<Response> {
  const { email, password, display_name, role_id } = payload;

  // Validate required fields
  if (!email || typeof email !== 'string') {
    return new Response(
      JSON.stringify({ error: 'El email es requerido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!password || typeof password !== 'string' || (password as string).length < 4) {
    return new Response(
      JSON.stringify({ error: 'La contraseña debe tener al menos 4 caracteres.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email as string)) {
    return new Response(
      JSON.stringify({ error: 'El formato de email es inválido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Insert (the trigger will validate uniqueness and role ownership)
  const { data, error } = await supabaseAdmin
    .from('staff_users')
    .insert({
      email: (email as string).trim().toLowerCase(),
      password,
      display_name: display_name || email,
      role_id: role_id || null,
      business_id: session.business_id,
      active: true,
    })
    .select('*, staff_roles(*)')
    .single();

  if (error) {
    if (error.message?.includes('Ya existe un usuario')) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    throw error;
  }

  // Never return the password
  const { password: _, ...safeData } = data;

  return new Response(
    JSON.stringify({ data: safeData }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── Delete Staff User ────────────────────────────────
async function handleDelete(
  session: { business_id: number; staff_id: number },
  payload: Record<string, unknown>
): Promise<Response> {
  const { id } = payload;

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'El ID del usuario es requerido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Prevent self-deletion
  if (id === session.staff_id) {
    return new Response(
      JSON.stringify({ error: 'No puede eliminarse a sí mismo.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Try hard delete first
  const { error, count } = await supabaseAdmin
    .from('staff_users')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('business_id', session.business_id);

  if (error) throw error;

  // Fallback: deactivate if delete was blocked
  if (count === 0) {
    const { error: updateError } = await supabaseAdmin
      .from('staff_users')
      .update({ active: false })
      .eq('id', id)
      .eq('business_id', session.business_id);

    if (updateError) throw updateError;
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── Update Staff Role ────────────────────────────────
async function handleUpdateRole(
  session: { business_id: number },
  payload: Record<string, unknown>
): Promise<Response> {
  const { userId, roleId } = payload;

  if (!userId || !roleId) {
    return new Response(
      JSON.stringify({ error: 'userId y roleId son requeridos.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // The trigger validates that the role belongs to the business
  const { error } = await supabaseAdmin
    .from('staff_users')
    .update({ role_id: roleId })
    .eq('id', userId)
    .eq('business_id', session.business_id);

  if (error) {
    if (error.message?.includes('no pertenece')) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    throw error;
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
