-- =====================================================
-- TurnIA — Migración 005: businesses.id INTEGER → UUID
-- =====================================================
--
-- PREREQUISITOS antes de ejecutar:
--   1. Hacer backup de la base de datos.
--   2. Desplegar los cambios de código (main.jsx, Sidebar.jsx,
--      edge functions) ANTES de ejecutar esta migración.
--   3. Ejecutar en: Supabase Dashboard → SQL Editor
--   4. Ejecutar TODO el bloque de una sola vez (BEGIN…COMMIT).
--
-- QUÉ HACE:
--   - Agrega una columna uuid nueva a `businesses`
--   - Propaga el UUID a todas las tablas hijas como business_id
--   - Elimina columnas integer antiguas
--   - Hace el UUID el nuevo PK de `businesses`
--   - Actualiza la función RPC create_patient_with_phone
--
-- TABLAS CUBIERTAS (verificar que no haya más en tu schema):
--   businesses, appointments, services, patients,
--   patient_phones, staff_users, staff_roles,
--   notifications, history, audit_log
--
-- NOTA: Si existe alguna tabla adicional que referencia
--   businesses(id) y no está aquí, la migración fallará
--   con un FK violation. Agrégala siguiendo el mismo patrón.
-- =====================================================

-- Eliminar la función RLS helper (y todas las policies que dependen de ella)
-- antes de cambiar los tipos de columna. rls_policies.sql las recrea al final.
DROP FUNCTION IF EXISTS get_user_business_id() CASCADE;

BEGIN;

-- ─── PASO 1: Agregar columna UUID temporal a businesses ───────────────────────
-- gen_random_uuid() genera un UUID v4 único por fila.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();

-- Asegurar que todas las filas existentes tengan un UUID asignado
UPDATE businesses SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- No puede ser NULL antes de convertirla en PK
ALTER TABLE businesses ALTER COLUMN new_id SET NOT NULL;


-- ─── PASO 2: Agregar columna UUID temporal en todas las tablas hijas ──────────

ALTER TABLE appointments  ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE services       ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE patients       ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE patient_phones ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE staff_users    ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE staff_roles    ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE notifications  ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE history        ADD COLUMN IF NOT EXISTS business_uuid UUID;
ALTER TABLE audit_log      ADD COLUMN IF NOT EXISTS business_uuid UUID;


-- ─── PASO 3: Poblar columnas UUID desde el mapping de businesses ──────────────
-- Deshabilitar triggers de validación para que el UPDATE no dispare
-- validate_appointment() ni validate_staff_user() sobre datos ya existentes.

ALTER TABLE appointments   DISABLE TRIGGER USER;
ALTER TABLE patients       DISABLE TRIGGER USER;
ALTER TABLE staff_users    DISABLE TRIGGER USER;

UPDATE appointments  a  SET business_uuid = b.new_id FROM businesses b WHERE a.business_id  = b.id;
UPDATE services      s  SET business_uuid = b.new_id FROM businesses b WHERE s.business_id  = b.id;
UPDATE patients      p  SET business_uuid = b.new_id FROM businesses b WHERE p.business_id  = b.id;
UPDATE patient_phones pp SET business_uuid = b.new_id FROM businesses b WHERE pp.business_id = b.id;
UPDATE staff_users   su SET business_uuid = b.new_id FROM businesses b WHERE su.business_id = b.id;
UPDATE staff_roles   sr SET business_uuid = b.new_id FROM businesses b WHERE sr.business_id = b.id;
UPDATE notifications n  SET business_uuid = b.new_id FROM businesses b WHERE n.business_id  = b.id;
UPDATE history       h  SET business_uuid = b.new_id FROM businesses b WHERE h.business_id  = b.id;
UPDATE audit_log     al SET business_uuid = b.new_id FROM businesses b WHERE al.business_id = b.id;

ALTER TABLE appointments   ENABLE TRIGGER USER;
ALTER TABLE patients       ENABLE TRIGGER USER;
ALTER TABLE staff_users    ENABLE TRIGGER USER;


-- ─── VERIFICACIÓN INTERMEDIA ─────────────────────────────────────────────────
-- Si alguna de estas queries devuelve filas, HAY DATOS HUÉRFANOS.
-- En ese caso hacer ROLLBACK y limpiar antes de continuar.
DO $$
DECLARE
  orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphans FROM appointments  WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'appointments tiene % filas huérfanas (business_uuid NULL)', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM services      WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'services tiene % filas huérfanas', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM patients      WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'patients tiene % filas huérfanas', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM patient_phones WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'patient_phones tiene % filas huérfanas', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM staff_users   WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'staff_users tiene % filas huérfanas', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM staff_roles   WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'staff_roles tiene % filas huérfanas', orphans; END IF;

  SELECT COUNT(*) INTO orphans FROM notifications  WHERE business_uuid IS NULL AND business_id IS NOT NULL;
  IF orphans > 0 THEN RAISE EXCEPTION 'notifications tiene % filas huérfanas', orphans; END IF;
END $$;


-- ─── PASO 4a: Eliminar vistas materializadas y funciones dependientes ────────
-- Se recrean manualmente después de la migración (ver sección POST-MIGRACIÓN).
DROP FUNCTION IF EXISTS get_business_stats() CASCADE;
DROP FUNCTION IF EXISTS get_patient_stats() CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_business_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_patient_stats CASCADE;

-- ─── PASO 4b: Eliminar constraints FK que dependen del INTEGER PK ─────────────
-- Los nombres exactos dependen de cómo Postgres los generó al crear las tablas.
-- Se usa IF EXISTS para no fallar si el nombre difiere en tu schema.
-- Las materialized views ya fueron dropeadas en PASO 4a.

ALTER TABLE appointments  DROP CONSTRAINT IF EXISTS appointments_business_id_fkey;
ALTER TABLE services       DROP CONSTRAINT IF EXISTS services_business_id_fkey;
ALTER TABLE patients       DROP CONSTRAINT IF EXISTS patients_business_id_fkey;
ALTER TABLE patient_phones DROP CONSTRAINT IF EXISTS patient_phones_business_id_fkey;
ALTER TABLE staff_users    DROP CONSTRAINT IF EXISTS staff_users_business_id_fkey;
ALTER TABLE staff_roles    DROP CONSTRAINT IF EXISTS staff_roles_business_id_fkey;
ALTER TABLE notifications  DROP CONSTRAINT IF EXISTS notifications_business_id_fkey;
ALTER TABLE history        DROP CONSTRAINT IF EXISTS history_business_id_fkey;
ALTER TABLE audit_log      DROP CONSTRAINT IF EXISTS audit_log_business_id_fkey;


-- ─── PASO 5: Reemplazar PK de businesses ──────────────────────────────────────

-- Primero eliminar el PK constraint (y su secuencia SERIAL implícita)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_pkey;

-- Eliminar columna integer antigua (CASCADE borra su secuencia SERIAL)
ALTER TABLE businesses DROP COLUMN id CASCADE;

-- Renombrar la columna UUID a 'id' y establecerla como PK
ALTER TABLE businesses RENAME COLUMN new_id TO id;
ALTER TABLE businesses ADD PRIMARY KEY (id);

-- DEFAULT gen_random_uuid() para nuevos INSERT
ALTER TABLE businesses ALTER COLUMN id SET DEFAULT gen_random_uuid();


-- ─── PASO 6: Reemplazar business_id en tablas hijas ──────────────────────────

-- appointments
ALTER TABLE appointments  DROP COLUMN business_id;
ALTER TABLE appointments  RENAME COLUMN business_uuid TO business_id;
ALTER TABLE appointments  ALTER COLUMN business_id SET NOT NULL;

-- services
ALTER TABLE services      DROP COLUMN business_id;
ALTER TABLE services      RENAME COLUMN business_uuid TO business_id;
ALTER TABLE services      ALTER COLUMN business_id SET NOT NULL;

-- patients
ALTER TABLE patients      DROP COLUMN business_id;
ALTER TABLE patients      RENAME COLUMN business_uuid TO business_id;
ALTER TABLE patients      ALTER COLUMN business_id SET NOT NULL;

-- patient_phones
ALTER TABLE patient_phones DROP COLUMN business_id;
ALTER TABLE patient_phones RENAME COLUMN business_uuid TO business_id;
ALTER TABLE patient_phones ALTER COLUMN business_id SET NOT NULL;

-- staff_users
ALTER TABLE staff_users   DROP COLUMN business_id;
ALTER TABLE staff_users   RENAME COLUMN business_uuid TO business_id;
ALTER TABLE staff_users   ALTER COLUMN business_id SET NOT NULL;

-- staff_roles
ALTER TABLE staff_roles   DROP COLUMN business_id;
ALTER TABLE staff_roles   RENAME COLUMN business_uuid TO business_id;
ALTER TABLE staff_roles   ALTER COLUMN business_id SET NOT NULL;

-- notifications
ALTER TABLE notifications  DROP COLUMN business_id;
ALTER TABLE notifications  RENAME COLUMN business_uuid TO business_id;
-- notifications.business_id puede ser NULL (no tiene NOT NULL en la migración original)

-- history
ALTER TABLE history        DROP COLUMN business_id;
ALTER TABLE history        RENAME COLUMN business_uuid TO business_id;
ALTER TABLE history        ALTER COLUMN business_id SET NOT NULL;

-- audit_log
ALTER TABLE audit_log      DROP COLUMN business_id;
ALTER TABLE audit_log      RENAME COLUMN business_uuid TO business_id;
ALTER TABLE audit_log      ALTER COLUMN business_id SET NOT NULL;


-- ─── PASO 7: Recrear FK constraints ──────────────────────────────────────────

ALTER TABLE appointments  ADD CONSTRAINT appointments_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE services      ADD CONSTRAINT services_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE patients      ADD CONSTRAINT patients_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE patient_phones ADD CONSTRAINT patient_phones_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE staff_users   ADD CONSTRAINT staff_users_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE staff_roles   ADD CONSTRAINT staff_roles_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE notifications  ADD CONSTRAINT notifications_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE history        ADD CONSTRAINT history_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE audit_log      ADD CONSTRAINT audit_log_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;


-- ─── PASO 8: Actualizar la función RPC create_patient_with_phone ─────────────
-- Cambia el parámetro p_business_id de INTEGER a UUID

-- Revocar los permisos de la firma antigua antes de reemplazarla
REVOKE ALL ON FUNCTION public.create_patient_with_phone(INTEGER, TEXT, TEXT) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.create_patient_with_phone(INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_patient_with_phone(
    p_business_id UUID,
    p_display_name TEXT,
    p_phone TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
BEGIN
    INSERT INTO public.patients (business_id, display_name)
    VALUES (p_business_id, p_display_name)
    RETURNING id INTO v_patient_id;

    INSERT INTO public.patient_phones (patient_id, phone, is_primary)
    VALUES (v_patient_id, p_phone, true);

    RETURN v_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_patient_with_phone(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_with_phone(UUID, TEXT, TEXT) TO authenticated;


-- ─── PASO 9: Índices recomendados ────────────────────────────────────────────
-- Asegurar que los índices en business_id sigan existiendo
-- (Postgres puede haberlos eliminado junto con la columna integer)

CREATE INDEX IF NOT EXISTS idx_appointments_business_id  ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_patients_business_id       ON patients(business_id);
CREATE INDEX IF NOT EXISTS idx_patient_phones_business_id ON patient_phones(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id       ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_business_id    ON staff_users(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_business_id    ON staff_roles(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_business_id  ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_history_business_id        ON history(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id      ON audit_log(business_id);


-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
-- Confirma que businesses.id ahora es UUID
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'id';

  IF col_type != 'uuid' THEN
    RAISE EXCEPTION 'ERROR: businesses.id sigue siendo % en lugar de uuid', col_type;
  END IF;

  RAISE NOTICE 'OK: businesses.id es uuid. Migración completada.';
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRACIÓN (ejecutar por separado si aplica):
--
-- 1. Si tienes vistas materializadas (mv_business_stats,
--    mv_patient_stats) que incluyen business_id, refrescarlas:
--      REFRESH MATERIALIZED VIEW mv_business_stats;
--      REFRESH MATERIALIZED VIEW mv_patient_stats;
--
-- 2. Si tienes tablas adicionales con business_id INTEGER
--    no cubiertas aquí, aplicar el mismo patrón manualmente.
--
-- 3. Si la tabla 'users' (legacy de patients) también existe
--    y tiene business_id INTEGER, migrarla igual.
-- =====================================================
