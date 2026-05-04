-- 012_offers.sql
-- Tabla de ofertas/precios dinámicos con RLS multi-tenant.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Tabla offers ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offers (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    service_id   uuid NOT NULL REFERENCES public.services(id)   ON DELETE CASCADE,
    name         text NOT NULL,
    description  text,
    promo_price  numeric(10,2) NOT NULL CHECK (promo_price >= 0),
    starts_at    timestamptz NOT NULL,
    ends_at      timestamptz NOT NULL CHECK (ends_at > starts_at),
    active       boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_no_overlap'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_no_overlap
      EXCLUDE USING gist (
        service_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (active = true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS offers_business_idx    ON public.offers (business_id);
CREATE INDEX IF NOT EXISTS offers_service_idx     ON public.offers (service_id);
CREATE INDEX IF NOT EXISTS offers_active_time_idx ON public.offers (active, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS offers_updated_at ON public.offers;
CREATE TRIGGER offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS offers ──────────────────────────────────────────────────────────────

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_select" ON public.offers;
CREATE POLICY "offers_select" ON public.offers
    FOR SELECT USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS "offers_insert" ON public.offers;
CREATE POLICY "offers_insert" ON public.offers
    FOR INSERT WITH CHECK (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS "offers_update" ON public.offers;
CREATE POLICY "offers_update" ON public.offers
    FOR UPDATE USING (business_id = public.get_user_business_id());

DROP POLICY IF EXISTS "offers_delete" ON public.offers;
CREATE POLICY "offers_delete" ON public.offers
    FOR DELETE USING (business_id = public.get_user_business_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;

-- ─── Vista services_with_active_offer ────────────────────────────────────────
-- WHERE s.business_id = get_user_business_id() garantiza aislamiento de tenant
-- aunque PostgREST no propague RLS de la tabla base a través de la vista.

DROP VIEW IF EXISTS public.services_with_active_offer;

CREATE VIEW public.services_with_active_offer AS
SELECT
    s.id,
    s.business_id,
    s.name,
    s.duration_minutes,
    s.price,
    s.active,
    o.id          AS offer_id,
    o.name        AS offer_name,
    o.description AS offer_description,
    o.promo_price,
    o.starts_at,
    o.ends_at,
    COALESCE(o.promo_price, s.price) AS effective_price
FROM public.services s
LEFT JOIN LATERAL (
    SELECT *
    FROM public.offers
    WHERE service_id  = s.id
      AND business_id = s.business_id
      AND active      = true
      AND now() >= starts_at
      AND now() <  ends_at
    ORDER BY created_at DESC
    LIMIT 1
) o ON true
WHERE s.business_id = public.get_user_business_id();

GRANT SELECT ON public.services_with_active_offer TO authenticated;
