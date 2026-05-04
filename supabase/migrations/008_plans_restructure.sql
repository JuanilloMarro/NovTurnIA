-- =====================================================
-- NovTurnIA — Migración 008: Reestructuración de Planes
-- =====================================================
--
-- PREREQUISITOS:
--   1. Hacer backup de la base de datos
--   2. Ejecutar en: Supabase Dashboard → SQL Editor
--   3. Ejecutar TODO el bloque de una sola vez
--
-- QUÉ HACE:
--   1. Crea ENUMs: plan_tier, plan_status_enum
--   2. Limpia y reestructura la tabla `plans` con UUID PK
--   3. Seedea los 3 planes (basic, pro, enterprise)
--   4. Agrega `plan_id` UUID FK a `businesses`
--   5. Migra datos existentes (text → UUID FK)
--   6. Convierte `businesses.plan_status` TEXT → ENUM
--   7. Actualiza la RPC `get_plan_limits`
-- =====================================================

BEGIN;

-- ─── PASO 1: Crear ENUMs ─────────────────────────────────────────────────────

-- Plan tier — solo estos 3 valores son válidos
DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('basic', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Plan status — estado de la suscripción del negocio
DO $$ BEGIN
  CREATE TYPE plan_status_enum AS ENUM ('active', 'suspended', 'cancelled', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── PASO 2: Limpiar y reestructurar tabla `plans` ───────────────────────────

-- Eliminar la tabla vieja (tenía id TEXT, sin estructura correcta)
DROP TABLE IF EXISTS plans CASCADE;

CREATE TABLE plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier              plan_tier NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    -- Precios en la unidad local (Quetzales). NULL = contactar ventas.
    monthly_price     INTEGER NOT NULL DEFAULT 0,
    -- Descuento anual en porcentaje (16 = 16% OFF → 10 meses al año)
    annual_discount   INTEGER NOT NULL DEFAULT 0,
    -- Límites — NULL = ilimitado
    max_patients      INTEGER,
    max_staff         INTEGER,
    max_appointments  INTEGER,
    max_conversations INTEGER,
    -- Feature flags extensibles (JSONB para escalar sin ALTER TABLE)
    features          JSONB NOT NULL DEFAULT '{}',
    -- Control de visibilidad y orden
    is_active         BOOLEAN NOT NULL DEFAULT true,
    display_order     INTEGER NOT NULL DEFAULT 0,
    -- Timestamps
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update de updated_at
CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_plans_updated_at();

-- RLS: cualquier usuario autenticado puede leer planes (son públicos)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_select ON plans;
CREATE POLICY plans_select ON plans
  FOR SELECT TO anon, authenticated USING (true);

-- Solo service_role puede INSERT/UPDATE/DELETE planes
-- (no se crea policy para INSERT/UPDATE/DELETE → bloqueado para auth users)


-- ─── PASO 3: Seedear los 3 planes ───────────────────────────────────────────

INSERT INTO plans (tier, name, monthly_price, annual_discount, max_patients, max_staff, max_appointments, max_conversations, features, display_order) VALUES
(
  'basic',
  'Básico',
  499,
  16,
  10,     -- max_patients (visibles en el front, soft-limit)
  1,      -- max_staff
  NULL,   -- max_appointments: ilimitado en todos los tiers (Agente IA)
  10,     -- max_conversations (visibles en el front, soft-limit)
  '{
    "ai_reasoning":        "standard",
    "ai_memory":           false,
    "dashboard":           "limited",
    "reminders":           false,
    "followup":            false,
    "export_patients":     false,
    "audit_log":           false,
    "custom_prompt":       false,
    "custom_roles":        false,
    "auto_confirm":        false,
    "content_gen":         false,
    "multi_branch":        false,
    "gmail_integration":   false,
    "dynamic_pricing":     false,
    "export_reports":      false,
    "service_description": false,
    "patient_notes":       false,
    "notification_email":  false
  }'::jsonb,
  1
),
(
  'pro',
  'Pro',
  999,
  16,
  100,    -- max_patients (visibles)
  5,      -- max_staff
  NULL,   -- max_appointments: ilimitado
  100,    -- max_conversations (visibles)
  '{
    "ai_reasoning":        "advanced",
    "ai_memory":           true,
    "dashboard":           "full",
    "reminders":           true,
    "followup":            true,
    "export_patients":     false,
    "audit_log":           true,
    "custom_prompt":       true,
    "custom_roles":        true,
    "auto_confirm":        false,
    "content_gen":         false,
    "multi_branch":        false,
    "gmail_integration":   false,
    "dynamic_pricing":     false,
    "export_reports":      false,
    "service_description": true,
    "patient_notes":       true,
    "notification_email":  false
  }'::jsonb,
  2
),
(
  'enterprise',
  'Enterprise',
  1999,
  16,
  NULL,   -- ilimitado
  NULL,   -- ilimitado
  NULL,   -- ilimitado
  NULL,   -- ilimitado
  '{
    "ai_reasoning": "premium",
    "ai_memory": true,
    "dashboard": "full",
    "reminders": true,
    "followup": true,
    "export_patients": true,
    "audit_log": true,
    "custom_prompt": true,
    "custom_roles": true,
    "auto_confirm": true,
    "content_gen": true,
    "multi_branch": true,
    "gmail_integration": true,
    "dynamic_pricing": true,
    "export_reports": true
  }'::jsonb,
  3
);


-- ─── PASO 4: Agregar plan_id FK a businesses ─────────────────────────────────

-- Agregar columna (nullable temporalmente para la migración)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_id UUID;

-- Migrar datos: mapear el TEXT plan → UUID plan_id
-- 'starter' y 'free' se mapean a 'basic' (unificación)
UPDATE businesses b
SET plan_id = p.id
FROM plans p
WHERE p.tier = (
  CASE
    WHEN b.plan IN ('starter', 'free') THEN 'basic'
    WHEN b.plan IN ('basic', 'pro', 'enterprise') THEN b.plan::plan_tier
    ELSE 'basic'  -- fallback para cualquier valor desconocido
  END
)::plan_tier;

-- Verificar que no quedaron NULLs
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphans FROM businesses WHERE plan_id IS NULL;
  IF orphans > 0 THEN
    -- Asignar basic como fallback final
    UPDATE businesses SET plan_id = (SELECT id FROM plans WHERE tier = 'basic')
    WHERE plan_id IS NULL;
    RAISE NOTICE 'Asignados % negocios huérfanos al plan basic', orphans;
  END IF;
END $$;

-- Ahora sí: NOT NULL + FK
ALTER TABLE businesses ALTER COLUMN plan_id SET NOT NULL;
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id);

-- Índice para JOINs eficientes
CREATE INDEX IF NOT EXISTS idx_businesses_plan_id ON businesses(plan_id);

-- Eliminar la columna TEXT vieja: ya no se usa, todo se rige por plan_id.
ALTER TABLE businesses DROP COLUMN IF EXISTS plan;


-- ─── PASO 5: Convertir plan_status TEXT → ENUM ──────────────────────────────

-- Normalizar valores existentes antes de castear
UPDATE businesses
SET plan_status = 'active'
WHERE plan_status IS NULL OR plan_status NOT IN ('active', 'suspended', 'cancelled', 'trial');

-- Eliminar el default antiguo para evitar errores de cast
ALTER TABLE businesses ALTER COLUMN plan_status DROP DEFAULT;

-- Eliminar CHECK constraints que dependan de comparar plan_status con texto
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_status_check;
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS plan_status_check;

-- Cambiar el tipo a ENUM
ALTER TABLE businesses
  ALTER COLUMN plan_status TYPE plan_status_enum
    USING plan_status::plan_status_enum;

-- Establecer el nuevo default y NOT NULL
ALTER TABLE businesses
  ALTER COLUMN plan_status SET DEFAULT 'active'::plan_status_enum,
  ALTER COLUMN plan_status SET NOT NULL;


-- ─── PASO 6: Actualizar RPC get_plan_limits ──────────────────────────────────

-- Drop firma anterior (puede tener firma diferente)
DROP FUNCTION IF EXISTS get_plan_limits(UUID);

CREATE OR REPLACE FUNCTION get_plan_limits(p_business_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'plan',              p.tier,
    'plan_name',         p.name,
    'plan_status',       b.plan_status,
    'monthly_price',     p.monthly_price,
    'max_patients',      p.max_patients,
    'max_staff',         p.max_staff,
    'max_appointments',  p.max_appointments,
    'max_conversations', p.max_conversations,
    'features',          p.features,
    'patients_used',     (SELECT COUNT(*) FROM public.patients
                          WHERE business_id = p_business_id AND deleted_at IS NULL),
    'staff_used',        (SELECT COUNT(*) FROM public.staff_users
                          WHERE business_id = p_business_id AND active = true)
  ) INTO result
  FROM public.businesses b
  JOIN public.plans p ON p.id = b.plan_id
  WHERE b.id = p_business_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_plan_limits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_plan_limits(UUID) TO authenticated;


-- ─── VERIFICACIÓN FINAL ──────────────────────────────────────────────────────

DO $$
DECLARE
  plan_count INTEGER;
  biz_count  INTEGER;
  null_plans INTEGER;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM plans;
  SELECT COUNT(*) INTO biz_count  FROM businesses;
  SELECT COUNT(*) INTO null_plans FROM businesses WHERE plan_id IS NULL;

  IF plan_count != 3 THEN
    RAISE EXCEPTION 'plans tiene % filas, se esperaban 3', plan_count;
  END IF;

  IF null_plans > 0 THEN
    RAISE EXCEPTION 'businesses tiene % filas con plan_id NULL', null_plans;
  END IF;

  RAISE NOTICE 'OK: % planes creados, % negocios migrados, 0 huérfanos.', plan_count, biz_count;
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRACIÓN:
--   1. Verificar: SELECT b.name, p.tier, b.plan_status
--                 FROM businesses b JOIN plans p ON p.id = b.plan_id;
--
--   2. Deploy del frontend actualizado
-- =====================================================
