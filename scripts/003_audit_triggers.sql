-- ============================================================
-- 003_audit_triggers.sql
-- Ejecutar en Supabase SQL Editor para automatizar la auditoría.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_audit_log()
RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_log (
        business_id,
        table_name,
        action,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        COALESCE(NEW.business_id, OLD.business_id),
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        auth.uid()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparadores para Turnos
DROP TRIGGER IF EXISTS trg_audit_appointments ON appointments;
CREATE TRIGGER trg_audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION handle_audit_log();

-- Disparadores para Pacientes
DROP TRIGGER IF EXISTS trg_audit_patients ON patients;
CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION handle_audit_log();

-- Disparadores para Teléfonos
DROP TRIGGER IF EXISTS trg_audit_patient_phones ON patient_phones;
CREATE TRIGGER trg_audit_patient_phones
    AFTER INSERT OR UPDATE OR DELETE ON patient_phones
    FOR EACH ROW EXECUTE FUNCTION handle_audit_log();

-- Info: Asegúrate de que las políticas RLS sobre audit_log sigan activadas.
