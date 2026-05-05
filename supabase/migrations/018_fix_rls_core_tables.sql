-- ============================================================
-- 018: Fix RLS en tablas core — appointments y patients
-- Las policies anteriores usaban USING (true), permitiendo que cualquier
-- usuario autenticado leyera datos de TODOS los negocios.
-- Se reemplazan por USING (business_id = get_user_business_id()).
-- ============================================================

-- ── appointments ─────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select"   ON appointments;
DROP POLICY IF EXISTS "appointments_insert"   ON appointments;
DROP POLICY IF EXISTS "appointments_update"   ON appointments;
DROP POLICY IF EXISTS "appointments_delete"   ON appointments;

CREATE POLICY "appointments_select" ON appointments
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id());

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "appointments_update" ON appointments
  FOR UPDATE TO authenticated
  USING  (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "appointments_delete" ON appointments
  FOR DELETE TO authenticated
  USING (business_id = get_user_business_id());

-- ── patients ──────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patients_select"   ON patients;
DROP POLICY IF EXISTS "patients_insert"   ON patients;
DROP POLICY IF EXISTS "patients_update"   ON patients;
DROP POLICY IF EXISTS "patients_delete"   ON patients;
-- Legacy name from migration 001
DROP POLICY IF EXISTS "users_select"      ON patients;
DROP POLICY IF EXISTS "users_insert"      ON patients;
DROP POLICY IF EXISTS "users_update"      ON patients;
DROP POLICY IF EXISTS "users_delete"      ON patients;

CREATE POLICY "patients_select" ON patients
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id());

CREATE POLICY "patients_insert" ON patients
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "patients_update" ON patients
  FOR UPDATE TO authenticated
  USING  (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "patients_delete" ON patients
  FOR DELETE TO authenticated
  USING (business_id = get_user_business_id());

-- ── services ──────────────────────────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_insert" ON services;
DROP POLICY IF EXISTS "services_update" ON services;
DROP POLICY IF EXISTS "services_delete" ON services;

CREATE POLICY "services_select" ON services
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id());

CREATE POLICY "services_insert" ON services
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "services_update" ON services
  FOR UPDATE TO authenticated
  USING  (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "services_delete" ON services
  FOR DELETE TO authenticated
  USING (business_id = get_user_business_id());

-- ── staff_users ───────────────────────────────────────────
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_users_select" ON staff_users;
DROP POLICY IF EXISTS "staff_users_insert" ON staff_users;
DROP POLICY IF EXISTS "staff_users_update" ON staff_users;
DROP POLICY IF EXISTS "staff_users_delete" ON staff_users;

CREATE POLICY "staff_users_select" ON staff_users
  FOR SELECT TO authenticated
  USING (business_id = get_user_business_id());

CREATE POLICY "staff_users_insert" ON staff_users
  FOR INSERT TO authenticated
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "staff_users_update" ON staff_users
  FOR UPDATE TO authenticated
  USING  (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "staff_users_delete" ON staff_users
  FOR DELETE TO authenticated
  USING (business_id = get_user_business_id());

-- ── phone_numbers / patient_phones ───────────────────────
-- Solo necesitan visibilidad si el paciente pertenece al negocio.
-- Se delega al JOIN con patients que ya tiene RLS.
-- No se necesita policy adicional si la tabla NO tiene business_id propio
-- y solo se accede via JOIN en queries con auth context.
