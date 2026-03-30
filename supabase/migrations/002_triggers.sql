-- =====================================================
-- TurnIA — Step 2: Database Triggers (Validation)
-- =====================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- Purpose: Server-side validation that CANNOT be
--   bypassed from the frontend.
-- =====================================================

-- ─── 1. Appointment conflict prevention ──────────────

CREATE OR REPLACE FUNCTION validate_appointment()
RETURNS TRIGGER AS $$
DECLARE
    biz RECORD;
    start_hour INTEGER;
    end_hour INTEGER;
BEGIN
    -- ── Validate date_start < date_end ───────────────
    IF NEW.date_start >= NEW.date_end THEN
        RAISE EXCEPTION 'La hora de inicio debe ser anterior a la hora de fin.';
    END IF;

    -- ── Validate within business hours ───────────────
    SELECT schedule_start, schedule_end
    INTO biz
    FROM businesses
    WHERE id = NEW.business_id;

    IF biz IS NULL THEN
        RAISE EXCEPTION 'El negocio con ID % no existe.', NEW.business_id;
    END IF;

    start_hour := EXTRACT(HOUR FROM NEW.date_start);
    end_hour := EXTRACT(HOUR FROM NEW.date_end);

    IF start_hour < biz.schedule_start OR end_hour > biz.schedule_end THEN
        RAISE EXCEPTION 'El turno está fuera del horario del negocio (% a %).',
            biz.schedule_start, biz.schedule_end;
    END IF;

    -- ── Validate no overlapping active appointments ──
    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE business_id = NEW.business_id
          AND status = 'active'
          AND id IS DISTINCT FROM NEW.id  -- Allow updating the same row
          AND NEW.date_start < date_end
          AND NEW.date_end > date_start
    ) THEN
        RAISE EXCEPTION 'Ya existe un turno activo en ese horario.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger: runs BEFORE INSERT and BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_validate_appointment ON appointments;
CREATE TRIGGER trg_validate_appointment
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION validate_appointment();

-- ─── 2. Staff user validation ────────────────────────

CREATE OR REPLACE FUNCTION validate_staff_user()
RETURNS TRIGGER AS $$
BEGIN
    /*
    -- ── Validate unique email per business ───────────
    -- NOTA: Validacion movida a capa de auth (auth.users)
    IF EXISTS (
        SELECT 1 FROM staff_users
        WHERE business_id = NEW.business_id
          AND email = NEW.email
          AND id IS DISTINCT FROM NEW.id
          AND active = true
    ) THEN
        RAISE EXCEPTION 'Ya existe un usuario con ese email en este negocio.';
    END IF;
    */

    -- ── Validate role belongs to same business ──────
    IF NEW.role_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM staff_roles
            WHERE id = NEW.role_id
              AND business_id = NEW.business_id
        ) THEN
            RAISE EXCEPTION 'El rol seleccionado no pertenece a este negocio.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_staff_user ON staff_users;
CREATE TRIGGER trg_validate_staff_user
    BEFORE INSERT OR UPDATE ON staff_users
    FOR EACH ROW
    EXECUTE FUNCTION validate_staff_user();

-- ─── 3. Patient (user) validation ────────────────────

CREATE OR REPLACE FUNCTION validate_patient()
RETURNS TRIGGER AS $$
BEGIN
    -- ── Validate phone number format (basic) ─────────
    IF NEW.id !~ '^\d{8,15}$' THEN
        RAISE EXCEPTION 'El número de teléfono debe contener solo dígitos (8-15 caracteres).';
    END IF;

    -- ── Validate business exists ─────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM businesses
        WHERE id = NEW.business_id AND active = true
    ) THEN
        RAISE EXCEPTION 'El negocio especificado no existe o está inactivo.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_patient ON users;
CREATE TRIGGER trg_validate_patient
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_patient();

-- ─── 4. Prevent physical deletion of appointments ────
-- Appointments should NEVER be deleted, only cancelled.

CREATE OR REPLACE FUNCTION prevent_appointment_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'No se permite eliminar turnos. Use status = cancelled en su lugar.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_appointment_delete ON appointments;
CREATE TRIGGER trg_prevent_appointment_delete
    BEFORE DELETE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_appointment_delete();

-- =====================================================
-- Test these triggers by running in SQL Editor:
--
-- 1. Overlapping appointment:
--    INSERT INTO appointments (business_id, user_id, date_start, date_end, status)
--    VALUES (1, '50247989357', '2026-03-15T10:00:00', '2026-03-15T11:00:00', 'active');
--    -- Run twice → second INSERT should fail
--
-- 2. Out-of-hours appointment:
--    INSERT INTO appointments (business_id, user_id, date_start, date_end, status)
--    VALUES (1, '50247989357', '2026-03-15T03:00:00', '2026-03-15T04:00:00', 'active');
--    -- Should fail (3 AM is before schedule_start=9)
--
-- 3. Delete appointment:
--    DELETE FROM appointments WHERE id = 1;
--    -- Should fail with "No se permite eliminar turnos"
-- =====================================================
