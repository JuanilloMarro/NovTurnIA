-- 026_pipeline_human_steps.sql
-- Distingue pasos que hace la IA (bot vía WhatsApp, cableados a pipeline_touch
-- — service_role únicamente) de pasos que hace el STAFF (llamadas de
-- recuperación, recordatorio, encuesta, solicitud de reseña — hoy sin ningún
-- motor automático en n8n: el propio Backlog Maestro documenta que el motor
-- de recordatorios "se vende pero no existe" — P0 abierto). Los pasos humanos
-- necesitan su PROPIO RPC para `authenticated`, con ownership-check real
-- (a diferencia de pipeline_touch, que no valida el caller porque es
-- exclusivo de service_role).

CREATE OR REPLACE FUNCTION public.set_pipeline_step(
    p_deal_id uuid,
    p_step    text,
    p_done    boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_biz      uuid;
    v_deal_biz uuid;
    v_n        int;
BEGIN
    -- Whitelist explícita: SOLO pasos humanos. Los pasos de IA
    -- (offered_services, offered_promo, queried_slots, confirmed_by_user,
    -- nps_score) se quedan exclusivos de pipeline_touch/service_role.
    IF p_step NOT IN ('reminder_sent','survey_sent','review_requested',
                      'recovery_1','recovery_2','recovery_3') THEN
        RAISE EXCEPTION 'set_pipeline_step: "%" no es un paso humano editable desde el dashboard', p_step;
    END IF;

    v_biz := public.get_user_business_id();
    SELECT business_id INTO v_deal_biz FROM public.pipeline_deals WHERE id = p_deal_id;
    IF v_deal_biz IS NULL THEN RAISE EXCEPTION 'Deal inexistente'; END IF;
    IF v_biz IS NOT NULL AND v_deal_biz <> v_biz THEN
        RAISE EXCEPTION 'Deal de otro negocio';
    END IF;

    IF p_step = 'reminder_sent' THEN
        UPDATE public.pipeline_deals SET
            reminder_sent = p_done,
            reminder_sent_at = CASE WHEN p_done THEN now() ELSE NULL END,
            last_activity_at = now()
        WHERE id = p_deal_id;
    ELSIF p_step = 'survey_sent' THEN
        UPDATE public.pipeline_deals SET
            survey_sent = p_done,
            survey_sent_at = CASE WHEN p_done THEN now() ELSE NULL END,
            last_activity_at = now()
        WHERE id = p_deal_id;
    ELSIF p_step = 'review_requested' THEN
        UPDATE public.pipeline_deals SET
            review_requested = p_done,
            review_requested_at = CASE WHEN p_done THEN now() ELSE NULL END,
            last_activity_at = now()
        WHERE id = p_deal_id;
    ELSE
        -- recovery_1/2/3: recovery_step sigue siendo UN solo contador (0-3),
        -- pero se expone como 3 checkboxes independientes. Marcar "Intento N"
        -- sube el contador a N (si no estaba ya ahí); desmarcarlo lo baja a
        -- N-1 — respeta el orden natural de una secuencia de llamadas.
        v_n := right(p_step, 1)::int;
        UPDATE public.pipeline_deals SET
            recovery_step = CASE WHEN p_done THEN GREATEST(recovery_step, v_n) ELSE LEAST(recovery_step, v_n - 1) END,
            recovery_last_at = CASE WHEN p_done THEN now() ELSE recovery_last_at END,
            last_activity_at = now()
        WHERE id = p_deal_id;
    END IF;

    INSERT INTO public.pipeline_events (business_id, deal_id, patient_id, event_type, source, summary)
    SELECT d.business_id, d.id, d.patient_id,
           p_step || (CASE WHEN p_done THEN '_done' ELSE '_undone' END), 'staff', NULL
      FROM public.pipeline_deals d WHERE d.id = p_deal_id;

    RETURN jsonb_build_object('deal_id', p_deal_id, 'step', p_step, 'done', p_done);
END $$;

REVOKE ALL ON FUNCTION public.set_pipeline_step(uuid,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_pipeline_step(uuid,text,boolean) TO authenticated, service_role;
