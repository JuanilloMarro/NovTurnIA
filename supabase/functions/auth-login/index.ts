// supabase/functions/auth-login/index.ts
// Edge Function: Staff authentication
// Replaces direct query to staff_users from frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { supabaseAdmin, createToken } from '../_shared/auth.ts';

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método no permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = await req.json();

    // ── Input validation ─────────────────────────────
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'El email es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'La contraseña es requerida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Query staff_users with service role (bypasses RLS) ──
    const { data: staffUser, error } = await supabaseAdmin
      .from('staff_users')
      .select(`
        *,
        staff_roles (*)
      `)
      .eq('email', email.trim().toLowerCase())
      .eq('password', password)
      .eq('active', true)
      .single();

    if (error || !staffUser) {
      return new Response(
        JSON.stringify({ error: 'Credenciales incorrectas o usuario inactivo' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Create JWT session token ─────────────────────
    const permissions = staffUser.staff_roles?.permissions || {};

    const token = await createToken({
      staff_id: staffUser.id,
      business_id: staffUser.business_id,
      role_id: staffUser.role_id,
      email: staffUser.email,
      display_name: staffUser.display_name || staffUser.email,
      role_name: staffUser.staff_roles?.name || 'unknown',
      permissions,
    });

    // ── Return user data + token (never return password) ──
    const { password: _, ...safeUser } = staffUser;

    return new Response(
      JSON.stringify({
        user: safeUser,
        token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('auth-login error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
