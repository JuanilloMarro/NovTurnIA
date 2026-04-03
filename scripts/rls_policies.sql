-- ============================================================
-- RLS POLICIES: Aislamiento multi-tenant por business_id
-- Ejecutar en Supabase SQL Editor DESPUÉS del seed_complete.sql
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- Habilitar RLS en todas las tablas del negocio
-- ════════════════════════════════════════════════════════════

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════
-- Helper function: obtener business_id del usuario autenticado
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  cached_bid TEXT;
  result_bid INTEGER;
BEGIN
  -- Intenta leer del cache de sesión (missing_ok=true evita exception si no existe)
  cached_bid := current_setting('app.business_id', true);
  IF cached_bid IS NOT NULL AND cached_bid <> '' THEN
    RETURN cached_bid::INTEGER;
  END IF;

  -- Cache miss: buscar en staff_users y guardar en variable de sesión
  SELECT business_id INTO result_bid
  FROM staff_users WHERE id = auth.uid() LIMIT 1;

  PERFORM set_config('app.business_id', result_bid::TEXT, true);
  RETURN result_bid;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- POLICIES por tabla (DROP IF EXISTS + CREATE)
-- ════════════════════════════════════════════════════════════

-- ── businesses ──
DROP POLICY IF EXISTS "Users can view their business" ON businesses;
CREATE POLICY "Users can view their business" ON businesses
  FOR SELECT USING (id = get_user_business_id());

-- ── staff_users ──
DROP POLICY IF EXISTS "Staff can view own business users" ON staff_users;
CREATE POLICY "Staff can view own business users" ON staff_users
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can insert in own business" ON staff_users;
CREATE POLICY "Staff can insert in own business" ON staff_users
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can update in own business" ON staff_users;
CREATE POLICY "Staff can update in own business" ON staff_users
  FOR UPDATE USING (business_id = get_user_business_id());

-- ── staff_roles ──
DROP POLICY IF EXISTS "Staff can view own business roles" ON staff_roles;
CREATE POLICY "Staff can view own business roles" ON staff_roles
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can update own business roles" ON staff_roles;
CREATE POLICY "Staff can update own business roles" ON staff_roles
  FOR UPDATE USING (business_id = get_user_business_id());

-- ── patients ──
DROP POLICY IF EXISTS "Staff can view own business patients" ON patients;
CREATE POLICY "Staff can view own business patients" ON patients
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can insert patients" ON patients;
CREATE POLICY "Staff can insert patients" ON patients
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can update patients" ON patients;
CREATE POLICY "Staff can update patients" ON patients
  FOR UPDATE USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can delete patients" ON patients;
CREATE POLICY "Staff can delete patients" ON patients
  FOR DELETE USING (business_id = get_user_business_id());

-- ── patient_phones ──
DROP POLICY IF EXISTS "Staff can view patient phones" ON patient_phones;
CREATE POLICY "Staff can view patient phones" ON patient_phones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_phones.patient_id
      AND p.business_id = get_user_business_id()
    )
  );

DROP POLICY IF EXISTS "Staff can insert patient phones" ON patient_phones;
CREATE POLICY "Staff can insert patient phones" ON patient_phones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_phones.patient_id
      AND p.business_id = get_user_business_id()
    )
  );

DROP POLICY IF EXISTS "Staff can update patient phones" ON patient_phones;
CREATE POLICY "Staff can update patient phones" ON patient_phones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_phones.patient_id
      AND p.business_id = get_user_business_id()
    )
  );

-- ── appointments ──
DROP POLICY IF EXISTS "Staff can view own business appointments" ON appointments;
CREATE POLICY "Staff can view own business appointments" ON appointments
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can insert appointments" ON appointments;
CREATE POLICY "Staff can insert appointments" ON appointments
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can update appointments" ON appointments;
CREATE POLICY "Staff can update appointments" ON appointments
  FOR UPDATE USING (business_id = get_user_business_id());

-- ── services ──
DROP POLICY IF EXISTS "Staff can view own business services" ON services;
CREATE POLICY "Staff can view own business services" ON services
  FOR SELECT USING (business_id = get_user_business_id());

-- ── history ──
DROP POLICY IF EXISTS "Staff can view own business history" ON history;
CREATE POLICY "Staff can view own business history" ON history
  FOR SELECT USING (business_id = get_user_business_id());

-- ── notifications ──
DROP POLICY IF EXISTS "Staff can view own business notifications" ON notifications;
CREATE POLICY "Staff can view own business notifications" ON notifications
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can update own business notifications" ON notifications;
CREATE POLICY "Staff can update own business notifications" ON notifications
  FOR UPDATE USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can delete own business notifications" ON notifications;
CREATE POLICY "Staff can delete own business notifications" ON notifications
  FOR DELETE USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can insert own business notifications" ON notifications;
CREATE POLICY "Staff can insert own business notifications" ON notifications
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

-- ── audit_log ──
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own business audit" ON audit_log;
CREATE POLICY "Staff can view own business audit" ON audit_log
  FOR SELECT USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Staff can insert audit" ON audit_log;
CREATE POLICY "Staff can insert audit" ON audit_log
  FOR INSERT WITH CHECK (business_id = get_user_business_id());

-- ── mv_business_stats ──
-- Materialized views no soportan RLS, pero ya se filtran por business_id en la query

-- ── mv_patient_stats ──
-- Same as above

-- ════════════════════════════════════════════════════════════
-- VERIFICACIÓN DE RLS
-- ════════════════════════════════════════════════════════════
-- Después de aplicar, verifica con:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('businesses', 'staff_users', 'staff_roles', 'patients', 'appointments', 'services', 'history', 'notifications', 'audit_log');
