// supabase/functions/create-appointment/index.ts
// Edge Function: Secure appointment creation
// Validates session, input, and delegates to DB (trigger validates conflicts)

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

    // ── Check permissions ────────────────────────────
    const canEdit = session.permissions?.edit_appointments !== false;
    if (!canEdit) {
      return new Response(
        JSON.stringify({ error: 'No tiene permisos para crear turnos.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, date, startTime, endTime } = await req.json();

    // ── Input validation ─────────────────────────────
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'El paciente es requerido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!date || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: 'Fecha, hora de inicio y hora de fin son requeridos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return new Response(
        JSON.stringify({ error: 'Formato de hora inválido. Use HH:MM.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build ISO timestamps ─────────────────────────
    const dateStr = date instanceof Date
      ? date.toISOString().slice(0, 10)
      : String(date).slice(0, 10);

    const dateStart = `${dateStr}T${startTime}:00`;
    const dateEnd = `${dateStr}T${endTime}:00`;

    // ── Verify patient exists ────────────────────────
    const { data: patient } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('business_id', session.business_id)
      .single();

    if (!patient) {
      return new Response(
        JSON.stringify({ error: 'El paciente no existe o no pertenece a este negocio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Insert appointment ───────────────────────────
    // The database trigger (trg_validate_appointment) will
    // validate conflicts and business hours server-side.
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        business_id: session.business_id,
        user_id: userId,
        date_start: dateStart,
        date_end: dateEnd,
        status: 'active',
        confirmed: false,
        notif_24hs: false,
      })
      .select('*, users(display_name)')
      .single();

    if (error) {
      // If the trigger raises an exception, Supabase returns it as an error
      const message = error.message || 'Error al crear el turno.';

      // Check if it's a trigger validation error
      if (message.includes('Ya existe un turno') || message.includes('fuera del horario')) {
        return new Response(
          JSON.stringify({ error: message }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw error;
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('create-appointment error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
