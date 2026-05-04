-- =====================================================
-- NovTurnIA — Migración 009: Enforcement de Planes Basic & Pro
-- =====================================================
--
-- DEPENDE DE: 008_plans_restructure.sql
--
-- QUÉ HACE:
--   1. Re-sincroniza los límites y feature flags de cada plan con el contrato
--      EXACTO definido en src/components/PlansModal.jsx (fuente de verdad UI).
--      - Corrige bug: max_appointments era 100/500 → debe ser NULL (Ilimitado)
--        para los 3 planes (el front muestra "Agente IA Ilimitado").
--      - Agrega el flag faltante `service_description` (Descripción detallada
--        para contexto de IA).
--      - Normaliza todos los flags en los 3 tiers (incluye los que estaban
--        omitidos en basic, ej. ai_memory: false explícito).
--   2. Agrega TRIGGERS BEFORE INSERT que bloquean a nivel DB:
--      - patients: si el negocio ya alcanzó max_patients del plan
--      - staff_users: si el negocio ya alcanzó max_staff (sólo cuenta active=true)
--   3. Expone helpers RPC para que edge functions / front consulten features:
--      - has_feature(feature_name): boolean
--      - enforce_feature(feature_name): RAISE EXCEPTION si el plan no la incluye
--
-- IMPORTANTE: NO toca el frontend. Los errores que devuelven los triggers
-- usan códigos custom (PT001 / PT002) detectables en supabaseService.
-- =====================================================

BEGIN;

-- ─── PASO 0: Asegurar columnas faltantes (defensivo si 008 quedó parcial) ────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_appointments  INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_conversations INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_discount   INTEGER NOT NULL DEFAULT 16;


-- ─── PASO 1: Re-sync de planes con el contrato del front ─────────────────────

-- BASIC: 10 pacientes, 1 staff, sin tope de citas, dashboard limitado
UPDATE plans SET
  max_patients      = 10,
  max_staff         = 1,
  max_appointments  = NULL,    -- Front: "Agente IA Ilimitado"
  max_conversations = 10,      -- Front: "Historial de Conversaciones: 10"
  features = '{
    "ai_reasoning":         "standard",
    "ai_memory":            false,
    "dashboard":            "limited",
    "reminders":            false,
    "followup":             false,
    "export_patients":      false,
    "audit_log":            false,
    "custom_prompt":        false,
    "custom_roles":         false,
    "auto_confirm":         false,
    "content_gen":          false,
    "multi_branch":         false,
    "gmail_integration":    false,
    "dynamic_pricing":      false,
    "export_reports":       false,
    "service_description":  false,
    "patient_notes":        false,
    "notification_email":   false
  }'::jsonb
WHERE tier = 'basic';

-- PRO: 100 pacientes, 5 staff, dashboard completo, todas las features de productividad
UPDATE plans SET
  max_patients      = 100,
  max_staff         = 5,
  max_appointments  = NULL,
  max_conversations = 100,
  features = '{
    "ai_reasoning":         "advanced",
    "ai_memory":            true,
    "dashboard":            "full",
    "reminders":            true,
    "followup":             true,
    "export_patients":      false,
    "audit_log":            true,
    "custom_prompt":        true,
    "custom_roles":         true,
    "auto_confirm":         false,
    "content_gen":          false,
    "multi_branch":         false,
    "gmail_integration":    false,
    "dynamic_pricing":      false,
    "export_reports":       false,
    "service_description":  true,
    "patient_notes":        true,
    "notification_email":   false
  }'::jsonb
WHERE tier = 'pro';

-- ENTERPRISE: queda igual (todo ilimitado / true). Se ajustarán detalles luego.
UPDATE plans SET
  max_patients      = NULL,
  max_staff         = NULL,
  max_appointments  = NULL,
  max_conversations = NULL
WHERE tier = 'enterprise';


-- ─── PASO 2: Trigger de límite de pacientes ─────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_patient_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max     INTEGER;
  v_current INTEGER;
BEGIN
  -- Obtener el máx del plan del negocio
  SELECT p.max_patients INTO v_max
  FROM public.businesses b
  JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = NEW.business_id;

  -- NULL = ilimitado → no bloquea
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar pacientes activos actuales (excluyendo soft-deleted)
  SELECT COUNT(*) INTO v_current
  FROM public.patients
  WHERE business_id = NEW.business_id
    AND deleted_at IS NULL;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % clientes de tu plan. Sube de plan para agregar más.', v_max
      USING ERRCODE = 'PT001',
            HINT    = 'PLAN_LIMIT_PATIENTS';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_patient_plan_limit ON patients;
CREATE TRIGGER trg_enforce_patient_plan_limit
  BEFORE INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION enforce_patient_plan_limit();


-- ─── PASO 3: Trigger de límite de staff ──────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_staff_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max     INTEGER;
  v_current INTEGER;
BEGIN
  -- Sólo cuenta usuarios activos. Reactivar uno previamente desactivado
  -- (active false → true) también dispara el chequeo vía UPDATE.
  IF (TG_OP = 'INSERT' AND NEW.active IS NOT TRUE)
     OR (TG_OP = 'UPDATE' AND (NEW.active IS NOT TRUE OR OLD.active = NEW.active)) THEN
    RETURN NEW;
  END IF;

  SELECT p.max_staff INTO v_max
  FROM public.businesses b
  JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = NEW.business_id;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current
  FROM public.staff_users
  WHERE business_id = NEW.business_id
    AND active = true
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % usuario(s) de tu plan. Sube de plan para agregar más.', v_max
      USING ERRCODE = 'PT002',
            HINT    = 'PLAN_LIMIT_STAFF';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_staff_plan_limit ON staff_users;
CREATE TRIGGER trg_enforce_staff_plan_limit
  BEFORE INSERT OR UPDATE OF active ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_staff_plan_limit();


-- ─── PASO 4: Helper RPC para chequear features ───────────────────────────────

DROP FUNCTION IF EXISTS has_feature(TEXT, UUID);
CREATE OR REPLACE FUNCTION has_feature(p_feature TEXT, p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT p.features -> p_feature INTO v_value
  FROM public.businesses b
  JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = p_business_id;

  IF v_value IS NULL THEN RETURN FALSE; END IF;

  -- Acepta tanto booleano como string no vacío (ej. dashboard: "full")
  RETURN (v_value::text)::jsonb <> 'false'::jsonb
         AND (v_value::text)::jsonb <> 'null'::jsonb
         AND v_value::text <> '""';
END;
$$;

REVOKE ALL ON FUNCTION has_feature(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_feature(TEXT, UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- enforce_feature(p_feature, p_business_id) → VOID
-- ─────────────────────────────────────────────────────────────────────────────
-- Guard de servidor: lanza RAISE EXCEPTION (ERRCODE 'PT003',
-- HINT 'PLAN_FEATURE_LOCKED') si el plan del negocio no tiene la feature.
-- Internamente delega en has_feature() que lee plans.features (JSONB).
--
-- CUÁNDO USARLA — proteger operaciones sensibles que NO deben depender solo
-- del gating del front (<FeatureLock> / hasFeature()):
--
--   1) Edge Functions premium (export-patients-csv, gmail-send, content-gen):
--        PERFORM enforce_feature('export_patients', business_id);
--      Evita que un cliente con plan basic invoque la function por curl y
--      obtenga el resultado aunque el botón esté oculto en la UI.
--
--   2) RPCs llamadas desde n8n / agentes externos cuyo efecto sea premium
--      (auto-confirm, reminders masivos, multi_branch). Una línea adentro
--      de la RPC y el workflow falla limpio si el negocio bajó de plan.
--
--   3) Triggers de DB para acciones premium si en el futuro se modela algún
--      campo cuya activación requiera plan (ej. dynamic_pricing en services).
--
-- CUÁNDO NO USARLA:
--   Si la feature es solo UI (mostrar/ocultar widgets, dashboard limited vs
--   full), el gate del front basta. enforce_feature es para proteger DATOS
--   o ACCIONES con efecto, no presentación.
--
-- CÓDIGO DE ERROR:
--   ERRCODE='PT003', HINT='PLAN_FEATURE_LOCKED'  → detectable en el service
--   layer para mostrar el modal de upgrade en lugar de un toast genérico.
--
-- ESTADO ACTUAL (2026-05-02):
--   Definida pero no llamada en ninguna edge function ni RPC todavía. Se deja
--   lista para cuando se construyan las primeras features premium con efecto
--   server-side (export, gmail, content gen).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS enforce_feature(TEXT, UUID);
CREATE OR REPLACE FUNCTION enforce_feature(p_feature TEXT, p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_feature(p_feature, p_business_id) THEN
    RAISE EXCEPTION 'Tu plan actual no incluye la función "%". Sube de plan para activarla.', p_feature
      USING ERRCODE = 'PT003',
            HINT    = 'PLAN_FEATURE_LOCKED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION enforce_feature(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_feature(TEXT, UUID) TO authenticated;


-- ─── PASO 5: Index de soporte para los triggers ─────────────────────────────

-- Acelera el COUNT del trigger de patients
CREATE INDEX IF NOT EXISTS idx_patients_business_active
  ON patients(business_id) WHERE deleted_at IS NULL;

-- Acelera el COUNT del trigger de staff
CREATE INDEX IF NOT EXISTS idx_staff_business_active
  ON staff_users(business_id) WHERE active = true;


-- ─── VERIFICACIÓN ────────────────────────────────────────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tier, max_patients, max_staff, max_appointments, max_conversations FROM plans ORDER BY display_order LOOP
    RAISE NOTICE 'Plan %: patients=%, staff=%, appts=%, convs=%',
      r.tier,
      COALESCE(r.max_patients::TEXT, '∞'),
      COALESCE(r.max_staff::TEXT, '∞'),
      COALESCE(r.max_appointments::TEXT, '∞'),
      COALESCE(r.max_conversations::TEXT, '∞');
  END LOOP;
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRACIÓN:
--   - Probar inserción más allá del límite (debe fallar con PT001 / PT002).
--   - El front PlansModal sigue funcionando sin cambios: getPlanLimits()
--     ahora devolverá max_patients=10 / max_appointments=NULL acorde al UI.
--   - Próximo paso opcional: enforce_feature en edge functions sensibles
--     (ej. exportar pacientes → enforce_feature('export_patients', bid)).
-- =====================================================
