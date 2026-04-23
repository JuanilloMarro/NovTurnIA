-- Migration: security_and_performance_fixes
-- Applied: 2026-04-20
-- Fixes critical security issues found in audit:
--   1. businesses_update RLS policy was USING(true) — any auth user could update any business
--   2. Partition tables had no RLS — cross-tenant data leak on history and audit_log
--   3. 3 functions had mutable search_path — SQL injection vector
--   4. appointments status CHECK missing 'completed'
--   5. Missing FK indexes + duplicate index on api_rate_limits
--   6. plans table had no RLS

-- ─── 1. businesses_update RLS ────────────────────────────────────────────────
DROP POLICY IF EXISTS businesses_update ON public.businesses;
CREATE POLICY businesses_update ON public.businesses
  FOR UPDATE TO authenticated
  USING (id = get_user_business_id())
  WITH CHECK (id = get_user_business_id());

-- ─── 2. RLS en particiones history ──────────────────────────────────────────
ALTER TABLE public.history_y2026m03 ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_y2026m03_select ON public.history_y2026m03
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY history_y2026m03_insert ON public.history_y2026m03
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.history_y2026m04 ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_y2026m04_select ON public.history_y2026m04
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY history_y2026m04_insert ON public.history_y2026m04
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.history_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY history_default_select ON public.history_default
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY history_default_insert ON public.history_default
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ─── 3. RLS en particiones audit_log ────────────────────────────────────────
ALTER TABLE public.audit_log_y2026m03 ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_y2026m03_select ON public.audit_log_y2026m03
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY audit_log_y2026m03_insert ON public.audit_log_y2026m03
  FOR INSERT TO authenticated WITH CHECK (business_id = get_user_business_id());

ALTER TABLE public.audit_log_y2026m04 ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_y2026m04_select ON public.audit_log_y2026m04
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY audit_log_y2026m04_insert ON public.audit_log_y2026m04
  FOR INSERT TO authenticated WITH CHECK (business_id = get_user_business_id());

ALTER TABLE public.audit_log_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_default_select ON public.audit_log_default
  FOR SELECT TO authenticated USING (business_id = get_user_business_id());
CREATE POLICY audit_log_default_insert ON public.audit_log_default
  FOR INSERT TO authenticated WITH CHECK (business_id = get_user_business_id());

-- ─── 4. search_path fijo en funciones ───────────────────────────────────────
ALTER FUNCTION public.validate_appointment()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_audit_log()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_rate_limit(character varying, timestamp with time zone)
  SET search_path = public, pg_temp;

-- ─── 5. appointments CHECK constraint incluye 'completed' ───────────────────
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::appt_status,
    'confirmed'::appt_status,
    'completed'::appt_status,
    'cancelled'::appt_status,
    'active'::appt_status,
    'no_show'::appt_status
  ]));

-- ─── 6. Índices FK faltantes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appt_service_id        ON public.appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_message_buffer_biz_id  ON public.message_buffer(business_id);
CREATE INDEX IF NOT EXISTS idx_notif_appointment_id   ON public.notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notif_patient_id       ON public.notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_role_id    ON public.staff_users(role_id);

-- ─── 7. Eliminar índice duplicado en api_rate_limits ─────────────────────────
ALTER TABLE public.api_rate_limits
  DROP CONSTRAINT IF EXISTS api_rate_limits_key_window_unique;

-- ─── 8. RLS en plans ─────────────────────────────────────────────────────────
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_select ON public.plans
  FOR SELECT TO anon, authenticated USING (true);
