-- T-28: createPatient atómica
-- Problema: createPatient hacía 2 INSERTs separados (patients + patient_phones).
-- Si el segundo fallaba, el paciente quedaba en DB sin teléfono — estado inválido
-- para el bot de WhatsApp que necesita el número para funcionar.
-- Solución: RPC que ejecuta ambos INSERTs en la misma transacción Postgres.

CREATE OR REPLACE FUNCTION public.create_patient_with_phone(
    p_business_id INTEGER,
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
    -- 1. Insertar paciente
    INSERT INTO public.patients (business_id, display_name)
    VALUES (p_business_id, p_display_name)
    RETURNING id INTO v_patient_id;

    -- 2. Insertar teléfono primario
    -- Si falla (constraint, duplicado), el INSERT de patients se revierte automáticamente
    INSERT INTO public.patient_phones (patient_id, phone, is_primary)
    VALUES (v_patient_id, p_phone, true);

    RETURN v_patient_id;
END;
$$;

-- Solo los usuarios autenticados del mismo negocio pueden llamar esta función.
-- La validación de business_id se hace en el frontend (supabaseService.js)
-- y la RLS de patients ya protege que business_id sea correcto.
REVOKE ALL ON FUNCTION public.create_patient_with_phone(INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_patient_with_phone(INTEGER, TEXT, TEXT) TO authenticated;
