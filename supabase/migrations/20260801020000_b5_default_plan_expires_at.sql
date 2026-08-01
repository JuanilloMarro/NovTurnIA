-- B5 · `plan_expires_at` nunca puede quedar NULL en un alta.
--
-- EL BUG: `onboard-tenant` creaba toda alta de PAGO con `plan_expires_at = NULL`
-- (solo el trial recibía fecha). El cron `run-dunning` vence por fecha, así que
-- un cliente que paga NUNCA entraba al ciclo de cobranza: su plan no se vencía
-- jamás y nadie le cobraba la renovación.
--
-- POR QUÉ ACÁ Y NO SOLO EN LA EDGE FUNCTION: un trigger cubre TODAS las vías de
-- alta (la Edge Function, un INSERT manual desde Studio, un seed, una migración
-- futura), no solo la que hoy conocemos. El arreglo en `onboard-tenant` también
-- se hizo y es compatible: este trigger solo rellena cuando viene NULL, así que
-- si la función manda fecha, la suya gana.
--
-- Aditivo y reversible: no toca filas existentes, solo altas nuevas.
--
-- PROBE (transaccional, con rollback por RAISE EXCEPTION):
--   alta de pago sin fecha  -> +1 mes    (2026-08-01 → 2026-09-01)
--   alta de trial sin fecha -> +14 días  (2026-08-01 → 2026-08-15)
--   alta con fecha explícita-> NO se pisa (2027-06-15 quedó intacta)

CREATE OR REPLACE FUNCTION public.set_default_plan_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.plan_expires_at IS NULL THEN
        -- Mismo criterio que `record_payment` al renovar: un mes calendario.
        -- El trial vence a los 14 días.
        NEW.plan_expires_at := CASE
            WHEN NEW.plan_status = 'trial' THEN now() + interval '14 days'
            ELSE now() + interval '1 month'
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_plan_expires_at ON public.businesses;

CREATE TRIGGER trg_default_plan_expires_at
    BEFORE INSERT ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_plan_expires_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: los negocios que YA existen con plan_expires_at NULL no se tocan a
-- propósito — cambiarle la fecha de cobranza a un cliente real es decisión
-- comercial, no técnica. Eso es B5b: un clic en "Marcar pagado" del AdminPanel
-- por negocio, que llama a record_payment() y deja el rastro en `payments`.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_default_plan_expires_at ON public.businesses;
--   DROP FUNCTION IF EXISTS public.set_default_plan_expires_at();
-- ─────────────────────────────────────────────────────────────────────────────
