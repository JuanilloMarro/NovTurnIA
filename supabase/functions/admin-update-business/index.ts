// supabase/functions/admin-update-business/index.ts
// Sincronizado desde producción (v8) el 2026-07-04 — el repo es la fuente de verdad.
// Actualiza campos de un negocio (allowlist) y/o envía email de reset de contraseña.
// Auth: app_super_admins por user_id (fuente de verdad) + SUPER_ADMIN_EMAIL como respaldo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPER_ADMIN_EMAIL = Deno.env.get("SUPER_ADMIN_EMAIL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Autorización: tabla app_super_admins por user_id (fuente de verdad),
    // con SUPER_ADMIN_EMAIL como respaldo.
    const { data: adminRow } = await supabase
      .from("app_super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const isEnvAdmin = !!SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL;
    if (!adminRow && !isEnvAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { business_id, updates } = body;

    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Update business fields ---
    if (updates && Object.keys(updates).length > 0) {
      const ALLOWED_FIELDS = [
        "name", "business_type", "timezone", "plan_status", "plan_id", "notification_email",
        "schedule_start", "schedule_end", "schedule_days", "appointment_duration",
        "custom_prompt", "feature_flags", "phone_number_id", "whatsapp_token",
        "ai_paused", "ai_paused_reason", "plan_expires_at", "limit_overrides",
      ];
      const sanitized: Record<string, unknown> = {};
      for (const key of ALLOWED_FIELDS) {
        if (key in updates) sanitized[key] = updates[key];
      }

      if (Object.keys(sanitized).length > 0) {
        const { error: updateError } = await supabase
          .from("businesses")
        .update(sanitized)
          .eq("id", business_id);
        if (updateError) throw updateError;
      }
    }

    // --- Marcar pagado: registra el pago y extiende plan_expires_at +1 mes ---
    // record_payment() (solo service_role) inserta en payments, reactiva el plan
    // (plan_status='active'), quita ai_paused y corre el ciclo de dunning real.
    if (body.record_payment) {
      const { amount, method, note } = body.record_payment;
      const { error: payError } = await supabase.rpc("record_payment", {
        p_business_id: business_id,
        p_amount: Number(amount) || 0,
        p_method: method || "manual",
        p_note: note || "Marcado pagado desde AdminPanel",
      });
      if (payError) throw payError;
    }

    // --- Reset password: send recovery email to a staff member ---
    if (body.reset_password_email) {
      const { error: resetError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: body.reset_password_email,
      });
      if (resetError) throw resetError;
    }

    // Return updated business (incl. nuevos campos)
    const { data: updated, error: fetchError } = await supabase
      .from("businesses")
      .select(`
        id, name, business_type, timezone, plan_status, notification_email, created_at,
        schedule_start, schedule_end, schedule_days, appointment_duration, custom_prompt,
        feature_flags, phone_number_id, whatsapp_token, ai_paused, ai_paused_reason, plan_expires_at, limit_overrides,
        plans ( id, tier, name, monthly_price, max_patients, max_staff, max_appointments, max_conversations )
      `)
      .eq("id", business_id)
      .single();

    if (fetchError) throw fetchError;

    return new Response(JSON.stringify(updated), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
