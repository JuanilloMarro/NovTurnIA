-- 025_pipeline_step_timestamps.sql
-- Cada paso del pipeline pasa de ser un boolean plano a tener SU PROPIO
-- timestamp — así el popover de detalle puede decir "hace 2h", no solo un
-- check. Es la diferencia entre "cosmético" y "respaldado en BD con control
-- real". No se edita 024 (ya aplicada en prod) — se agrega incremental.

ALTER TABLE public.pipeline_deals
    ADD COLUMN IF NOT EXISTS offered_services_at  timestamptz,
    ADD COLUMN IF NOT EXISTS offered_promo_at     timestamptz,
    ADD COLUMN IF NOT EXISTS reminder_sent_at     timestamptz,
    ADD COLUMN IF NOT EXISTS confirmed_at         timestamptz,
    ADD COLUMN IF NOT EXISTS survey_sent_at       timestamptz,
    ADD COLUMN IF NOT EXISTS review_requested_at  timestamptz,
    ADD COLUMN IF NOT EXISTS recovery_last_at     timestamptz,
    ADD COLUMN IF NOT EXISTS nps_at               timestamptz;
-- queried_slots ya tenía su propio timestamp (slot_offered_at) desde 024.

-- pipeline_touch: sella el timestamp del paso que se está tocando.
CREATE OR REPLACE FUNCTION public.pipeline_touch(
    p_business_id uuid, p_patient_id uuid, p_flag text,
    p_summary text DEFAULT NULL, p_value int DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_deal_id uuid;
    v_stage   text;
BEGIN
    IF p_business_id IS NULL OR p_patient_id IS NULL OR p_flag IS NULL THEN
        RAISE EXCEPTION 'pipeline_touch: business_id, patient_id y flag son obligatorios';
    END IF;

    IF p_flag NOT IN ('offered_services','offered_promo','queried_slots','slot_offered',
                      'reminder_sent','confirmed_by_user','survey_sent','review_requested',
                      'recovery_step','nps_score','activity') THEN
        RAISE EXCEPTION 'pipeline_touch: bandera desconocida "%"', p_flag;
    END IF;

    SELECT id INTO v_deal_id FROM public.pipeline_deals
     WHERE business_id = p_business_id AND patient_id = p_patient_id AND closed_at IS NULL LIMIT 1;

    IF v_deal_id IS NULL THEN
        INSERT INTO public.pipeline_deals (business_id, patient_id, last_activity_at)
        VALUES (p_business_id, p_patient_id, now())
        RETURNING id INTO v_deal_id;
    END IF;

    UPDATE public.pipeline_deals SET
        offered_services  = offered_services  OR (p_flag = 'offered_services'),
        offered_services_at = CASE WHEN p_flag = 'offered_services' THEN now() ELSE offered_services_at END,
        offered_promo     = offered_promo     OR (p_flag = 'offered_promo'),
        offered_promo_at  = CASE WHEN p_flag = 'offered_promo' THEN now() ELSE offered_promo_at END,
        queried_slots     = queried_slots     OR (p_flag IN ('queried_slots','slot_offered')),
        reminder_sent     = reminder_sent     OR (p_flag = 'reminder_sent'),
        reminder_sent_at  = CASE WHEN p_flag = 'reminder_sent' THEN now() ELSE reminder_sent_at END,
        confirmed_by_user = confirmed_by_user OR (p_flag = 'confirmed_by_user'),
        confirmed_at      = CASE WHEN p_flag = 'confirmed_by_user' THEN now() ELSE confirmed_at END,
        survey_sent       = survey_sent       OR (p_flag = 'survey_sent'),
        survey_sent_at    = CASE WHEN p_flag = 'survey_sent' THEN now() ELSE survey_sent_at END,
        review_requested  = review_requested  OR (p_flag = 'review_requested'),
        review_requested_at = CASE WHEN p_flag = 'review_requested' THEN now() ELSE review_requested_at END,
        recovery_step     = CASE WHEN p_flag = 'recovery_step'
                                 THEN LEAST(COALESCE(p_value, recovery_step + 1), 3)
                                 ELSE recovery_step END,
        recovery_last_at  = CASE WHEN p_flag = 'recovery_step' THEN now() ELSE recovery_last_at END,
        nps_score         = CASE WHEN p_flag = 'nps_score' THEN p_value ELSE nps_score END,
        nps_at            = CASE WHEN p_flag = 'nps_score' THEN now() ELSE nps_at END,
        slot_offered_at   = CASE WHEN p_flag = 'slot_offered' THEN now() ELSE slot_offered_at END,
        last_ai_action    = COALESCE(p_summary, last_ai_action),
        last_activity_at  = now()
     WHERE id = v_deal_id;

    INSERT INTO public.pipeline_events
        (business_id, deal_id, patient_id, event_type, source, summary, metadata)
    VALUES (p_business_id, v_deal_id, p_patient_id, p_flag, 'bot', p_summary, COALESCE(p_metadata,'{}'::jsonb));

    v_stage := public.pipeline_recompute_stage(v_deal_id);

    RETURN jsonb_build_object('deal_id', v_deal_id, 'stage', v_stage);
END $$;

-- get_pipeline_board: cambia el shape de retorno (agrega columnas de
-- timestamp) → hay que dropear la firma anterior antes de recrearla.
DROP FUNCTION IF EXISTS public.get_pipeline_board(uuid, int);

CREATE FUNCTION public.get_pipeline_board(p_business_id uuid DEFAULT NULL, p_days int DEFAULT 90)
RETURNS TABLE (
    deal_id uuid, patient_id uuid, appointment_id uuid,
    display_name text, phone text, human_takeover boolean,
    stage text, stage_source text, temperature text,
    service_name text, date_start timestamptz, appointment_status text,
    offered_services boolean, offered_services_at timestamptz,
    offered_promo boolean, offered_promo_at timestamptz,
    queried_slots boolean, slot_offered_at timestamptz,
    reminder_sent boolean, reminder_sent_at timestamptz,
    confirmed_by_user boolean, confirmed_at timestamptz,
    survey_sent boolean, survey_sent_at timestamptz,
    review_requested boolean, review_requested_at timestamptz,
    recovery_step smallint, recovery_last_at timestamptz,
    nps_score smallint, nps_at timestamptz,
    last_ai_action text, last_activity_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz uuid;
BEGIN
    v_biz := public.get_user_business_id();
    IF v_biz IS NULL THEN v_biz := p_business_id; END IF;
    IF v_biz IS NULL THEN RETURN; END IF;

    RETURN QUERY
    SELECT
        d.id, d.patient_id, d.appointment_id,
        COALESCE(p.display_name, 'Sin nombre')::text,
        ph.phone::text,
        COALESCE(p.human_takeover, false),
        d.stage, d.stage_source,
        CASE
            WHEN d.stage = 'scheduled' THEN 'hot'
            WHEN d.last_activity_at > now() - interval '6 hours' THEN 'hot'
            WHEN d.last_activity_at > now() - interval '48 hours' THEN 'warm'
            ELSE 'cold'
        END::text,
        s.name::text, a.date_start, a.status::text,
        d.offered_services, d.offered_services_at,
        d.offered_promo, d.offered_promo_at,
        d.queried_slots, d.slot_offered_at,
        d.reminder_sent, d.reminder_sent_at,
        d.confirmed_by_user, d.confirmed_at,
        d.survey_sent, d.survey_sent_at,
        d.review_requested, d.review_requested_at,
        d.recovery_step, d.recovery_last_at,
        d.nps_score, d.nps_at,
        d.last_ai_action, d.last_activity_at, d.created_at
    FROM public.pipeline_deals d
    JOIN public.patients p ON p.id = d.patient_id AND p.deleted_at IS NULL
    LEFT JOIN LATERAL (
        SELECT pp.phone FROM public.patient_phones pp
         WHERE pp.patient_id = d.patient_id
         ORDER BY pp.is_primary DESC NULLS LAST LIMIT 1
    ) ph ON true
    LEFT JOIN public.appointments a ON a.id = d.appointment_id
    LEFT JOIN public.services s     ON s.id = a.service_id
    WHERE d.business_id = v_biz
      AND d.stage <> 'lost'
      AND d.closed_at IS NULL
      AND d.last_activity_at >= now() - make_interval(days => GREATEST(p_days, 1))
    ORDER BY d.last_activity_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_pipeline_board(uuid,int) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pipeline_board(uuid,int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pipeline_touch(uuid,uuid,text,text,int,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_touch(uuid,uuid,text,text,int,jsonb) TO service_role;
