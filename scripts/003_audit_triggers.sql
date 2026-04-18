-- ============================================================
-- 003_audit_triggers.sql
-- Ejecutar en Supabase SQL Editor para automatizar la auditoría.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_audit_log()
RETURNS trigger AS $$
DECLARE
    computed_business_id UUID;
    computed_record_id   TEXT;
    computed_old_data    JSON;
    computed_new_data    JSON;
BEGIN
    -- Guard: evitar recursion si el trigger se instala sobre audit_log
    IF TG_TABLE_NAME = 'audit_log' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- TEXT para record_id soporta PKs UUID, INTEGER o BIGINT sin error de cast
    IF TG_OP = 'DELETE' THEN
        computed_business_id := (to_jsonb(OLD)->>'business_id')::UUID;
        computed_record_id   := to_jsonb(OLD)->>'id';
        computed_old_data    := row_to_json(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        computed_business_id := (to_jsonb(NEW)->>'business_id')::UUID;
        computed_record_id   := to_jsonb(NEW)->>'id';
        computed_new_data    := row_to_json(NEW);
    ELSE
        computed_business_id := (to_jsonb(NEW)->>'business_id')::UUID;
        computed_record_id   := to_jsonb(NEW)->>'id';
        computed_old_data    := row_to_json(OLD);
        computed_new_data    := row_to_json(NEW);
    END IF;

    INSERT INTO audit_log (
        business_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        computed_business_id,
        TG_TABLE_NAME,
        computed_record_id,
        TG_OP::audit_action,
        computed_old_data,
        computed_new_data,
        auth.uid()
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. LIMPIAR TODOS LOS TRIGGERS (Incluso los problemáticos)
DROP TRIGGER IF EXISTS trg_audit_patient_phones ON patient_phones;
DROP TRIGGER IF EXISTS trg_audit_appointments ON appointments;
DROP TRIGGER IF EXISTS trg_audit_patients ON patients;

-- 2. DISPARADORES LIMPIOS SOLO A TABLAS MAESTRAS
CREATE TRIGGER trg_audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION handle_audit_log();

CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION handle_audit_log();
