// supabase/functions/export-tenant-data/index.ts
// v1 (2026-07-11): Export completo de los datos de un tenant a JSON en Storage
// (bucket privado `exports`) con URL firmada de 24h. Sirve para churn ordenado
// ("te llevas tus datos") y como backup lógico por-tenant.
// Auth: solo super-admin (app_super_admins + SUPER_ADMIN_EMAIL como respaldo).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPER_ADMIN_EMAIL = Deno.env.get("SUPER_ADMIN_EMAIL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: adminRow } = await supabase
      .from("app_super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const isEnvAdmin = !!SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL;
    if (!adminRow && !isEnvAdmin) return json({ error: "Forbidden" }, 403);

    const { business_id } = await req.json();
    if (!business_id) return json({ error: "business_id is required" }, 400);

    // ── Recolectar datos del tenant (solo tablas de producto; sin tokens/secretos) ──
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, business_type, timezone, plan_status, plan_expires_at, schedule_start, schedule_end, schedule_days, appointment_duration, created_at, plans(tier, name, monthly_price)")
      .eq("id", business_id)
      .single();
    if (bizError || !business) return json({ error: "Negocio no encontrado" }, 404);

    const pick = async (table: string, select: string, order?: string) => {
      let q = supabase.from(table).select(select).eq("business_id", business_id);
      if (order) q = q.order(order, { ascending: true });
      const { data, error } = await q.limit(10000);
      if (error) throw new Error(`${table}: ${error.message}`);
      return data ?? [];
    };

    const [patients, phones, appointments, services, income, expenses, categories, supplies] = await Promise.all([
      pick("patients", "id, display_name, notes, human_takeover, deleted_at, created_at", "created_at"),
      pick("patient_phones", "patient_id, phone, is_primary"),
      pick("appointments", "id, patient_id, service_id, date_start, date_end, status, confirmed, created_by, created_at", "date_start"),
      pick("services", "id, name, description, duration_minutes, price, active"),
      pick("income_entries", "id, amount, source, payment_method, description, occurred_at, status, category_id", "occurred_at"),
      pick("expense_entries", "id, amount, category, category_id, description, recurring, occurred_at, status", "occurred_at"),
      pick("finance_categories", "id, kind, name, color, active"),
      pick("supplies", "id, name, unit, unit_cost, category, active"),
    ]);

    const exportDoc = {
      exported_at: new Date().toISOString(),
      format_version: 1,
      business,
      counts: {
        patients: patients.length, appointments: appointments.length, services: services.length,
        income_entries: income.length, expense_entries: expenses.length,
        finance_categories: categories.length, supplies: supplies.length,
      },
      patients, patient_phones: phones, appointments, services,
      income_entries: income, expense_entries: expenses,
      finance_categories: categories, supplies,
    };

    // ── Subir al bucket privado y firmar URL de 24h ──────────────────────────
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const path = `${business_id}/export-${stamp}.json`;
    const blob = new Blob([JSON.stringify(exportDoc, null, 2)], { type: "application/json" });

    const { error: upError } = await supabase.storage.from("exports").upload(path, blob, { upsert: true, contentType: "application/json" });
    if (upError) throw new Error(`Storage: ${upError.message}`);

    const { data: signed, error: signError } = await supabase.storage.from("exports").createSignedUrl(path, 60 * 60 * 24);
    if (signError) throw new Error(`SignedURL: ${signError.message}`);

    return json({ url: signed.signedUrl, path, counts: exportDoc.counts });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
