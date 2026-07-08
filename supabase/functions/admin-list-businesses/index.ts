// supabase/functions/admin-list-businesses/index.ts
// Sincronizado desde producción (v8) el 2026-07-04 — el repo es la fuente de verdad.
// Lista todos los negocios con métricas de uso para el panel de super-admin.
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

    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select(`
        id, name, business_type, timezone, plan_status, notification_email, created_at,
        schedule_start, schedule_end, schedule_days, appointment_duration, custom_prompt,
        feature_flags, phone_number_id, whatsapp_token, ai_paused, ai_paused_reason, plan_expires_at, plan_id, limit_overrides,
        plans ( id, tier, name, monthly_price, max_patients, max_staff, max_appointments, max_conversations )
      `)
      .order("created_at", { ascending: false });

    if (bizError) throw bizError;

    // Uso del mes actual (un solo query, luego se mapea por negocio)
    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const { data: usageRows } = await supabase
      .from("usage_counters")
      .select("business_id, messages, tokens_total")
      .eq("period", period);
    const usageMap = new Map((usageRows ?? []).map((u) => [u.business_id, u]));

    const results = await Promise.all(
      (businesses ?? []).map(async (biz) => {
        const [patientsRes, appointmentsRes, staffRes] = await Promise.all([
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("business_id", biz.id),
          supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", biz.id),
          supabase.from("staff_users").select("id", { count: "exact", head: true }).eq("business_id", biz.id).eq("active", true),
        ]);

        const { data: adminStaff } = await supabase
          .from("staff_users")
          .select("full_name, email, staff_roles(name)")
          .eq("business_id", biz.id)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const usage = usageMap.get(biz.id);

        return {
          ...biz,
          patient_count: patientsRes.count ?? 0,
          appointment_count: appointmentsRes.count ?? 0,
          staff_count: staffRes.count ?? 0,
          messages_used: usage?.messages ?? 0,
          tokens_used: usage?.tokens_total ?? 0,
          admin_name: adminStaff?.full_name ?? null,
          admin_email: adminStaff?.email ?? null,
        };
      })
    );

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
