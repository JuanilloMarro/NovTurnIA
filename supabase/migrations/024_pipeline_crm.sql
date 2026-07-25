-- 024_pipeline_crm.sql
-- Módulo Pipeline CRM — tablero tipo Pipedrive de 5 etapas.
--
-- EJE DEL DISEÑO: la unidad es la OPORTUNIDAD (deal) ligada a un turno, no el
-- cliente. Un cliente recurrente genera un deal nuevo por ciclo; así el tablero
-- sigue el estado de cada turno sin que un cliente con miles de citas colapse
-- en una sola tarjeta.
--
-- CONTRATO n8n: una sola llamada, un solo parámetro → public.pipeline_touch().
--
-- Escrita de forma DEFENSIVA porque el repo y la DB en vivo difieren en el
-- nombre de algunas funciones helper (handle_audit_log vs trigger_audit_log) y
-- porque is_business_active() se creó vía MCP sin archivo versionado.
-- Idempotente: se puede correr más de una vez sin romper nada.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pipeline_deals (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       uuid NOT NULL REFERENCES public.businesses(id)   ON DELETE CASCADE,
    patient_id        uuid NOT NULL REFERENCES public.patients(id)     ON DELETE CASCADE,
    -- El turno se liga en cuanto existe. SET NULL para no perder el deal si el
    -- turno se borra en duro (mismo criterio que notifications.appointment_id).
    appointment_id    uuid REFERENCES public.appointments(id)          ON DELETE SET NULL,

    stage             text NOT NULL DEFAULT 'discovery'
                      CHECK (stage IN ('discovery','negotiation','scheduled','recovery','loyalty','lost')),
    -- 'manual' = el staff arrastró la tarjeta. Solo se respeta mientras la
    -- realidad no lo contradiga (ver pipeline_recompute_stage).
    stage_source      text NOT NULL DEFAULT 'auto' CHECK (stage_source IN ('auto','manual')),

    -- ── Banderas de IA ── n8n solo manda el nombre; el RPC pone el true ──
    offered_services  boolean NOT NULL DEFAULT false,
    offered_promo     boolean NOT NULL DEFAULT false,
    queried_slots     boolean NOT NULL DEFAULT false,
    reminder_sent     boolean NOT NULL DEFAULT false,
    confirmed_by_user boolean NOT NULL DEFAULT false,
    survey_sent       boolean NOT NULL DEFAULT false,
    review_requested  boolean NOT NULL DEFAULT false,
    recovery_step     smallint NOT NULL DEFAULT 0 CHECK (recovery_step BETWEEN 0 AND 3),
    nps_score         smallint CHECK (nps_score BETWEEN 1 AND 5),

    slot_offered_at   timestamptz,
    next_control_due  date,
    last_ai_action    text,                                   -- micro-texto de la tarjeta
    last_activity_at  timestamptz NOT NULL DEFAULT now(),
    closed_at         timestamptz,                            -- NULL = deal abierto
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Un solo deal ABIERTO por cliente. Es lo que hace trivial el contrato de n8n:
-- "el deal abierto de este paciente" es siempre no ambiguo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_open_deal
    ON public.pipeline_deals (business_id, patient_id) WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_board
    ON public.pipeline_deals (business_id, stage, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_appointment
    ON public.pipeline_deals (appointment_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_patient
    ON public.pipeline_deals (patient_id);


CREATE TABLE IF NOT EXISTS public.pipeline_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id)      ON DELETE CASCADE,
    deal_id     uuid NOT NULL REFERENCES public.pipeline_deals(id)  ON DELETE CASCADE,
    patient_id  uuid REFERENCES public.patients(id)                 ON DELETE CASCADE,
    event_type  text NOT NULL,
    source      text NOT NULL DEFAULT 'bot' CHECK (source IN ('bot','staff','system')),
    summary     text,
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_deal
    ON public.pipeline_events (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_biz
    ON public.pipeline_events (business_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TRIGGERS DE INFRAESTRUCTURA (updated_at + audit)
-- ═══════════════════════════════════════════════════════════════════════════

-- trigger_set_updated_at() ya existe en producción (mismo patrón que
-- finance_categories/schedule_exceptions) — se reusa en vez de duplicarla.
-- Fallback a una función local solo si el nombre no existiera en este entorno.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname = 'trigger_set_updated_at') THEN
        CREATE FUNCTION public.trigger_set_updated_at()
        RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN NEW.updated_at = now(); RETURN NEW; END;
        $fn$;
    END IF;
END $$;

DROP TRIGGER IF EXISTS pipeline_deals_updated_at ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_updated_at
    BEFORE UPDATE ON public.pipeline_deals
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- NOTA — desviación deliberada del patrón de finance_categories/supplies:
-- NO se engancha trigger de audit_log en pipeline_deals. Cada mensaje del bot
-- dispara un UPDATE del deal (pipeline_touch), así que auditar esta tabla
-- generaría una fila de audit_log por mensaje de WhatsApp — infla una tabla
-- particionada que se retiene 4 meses, sin valor de cumplimiento. La tabla
-- pipeline_events YA es el registro append-only e inmutable de esta entidad.


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS
--    Asimetría deliberada del proyecto: un negocio suspendido puede LEER pero
--    no ESCRIBIR. El gate is_business_active() se aplica solo si existe.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pipeline_deals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    v_biz   text := '(business_id = (SELECT public.get_user_business_id()))';
    v_write text;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'is_business_active') THEN
        v_write := v_biz || ' AND (SELECT public.is_business_active())';
    ELSE
        v_write := v_biz;
        RAISE NOTICE 'is_business_active() no existe — políticas sin gate de suspensión';
    END IF;

    -- pipeline_deals: CRUD completo para el tenant
    -- CREATE POLICY exige el paréntesis alrededor de la expresión completa
    -- (no es solo estilo) — de ahí el %s envuelto en (%s) en cada format().
    EXECUTE 'DROP POLICY IF EXISTS pipeline_deals_select ON public.pipeline_deals';
    EXECUTE format('CREATE POLICY pipeline_deals_select ON public.pipeline_deals FOR SELECT USING (%s)', v_biz);

    EXECUTE 'DROP POLICY IF EXISTS pipeline_deals_insert ON public.pipeline_deals';
    EXECUTE format('CREATE POLICY pipeline_deals_insert ON public.pipeline_deals FOR INSERT WITH CHECK (%s)', v_write);

    EXECUTE 'DROP POLICY IF EXISTS pipeline_deals_update ON public.pipeline_deals';
    EXECUTE format('CREATE POLICY pipeline_deals_update ON public.pipeline_deals FOR UPDATE USING (%s) WITH CHECK (%s)', v_write, v_write);

    EXECUTE 'DROP POLICY IF EXISTS pipeline_deals_delete ON public.pipeline_deals';
    EXECUTE format('CREATE POLICY pipeline_deals_delete ON public.pipeline_deals FOR DELETE USING (%s)', v_write);

    -- pipeline_events: append-only. Sin UPDATE/DELETE para authenticated —
    -- es el registro de trazabilidad, no debe poder reescribirse.
    EXECUTE 'DROP POLICY IF EXISTS pipeline_events_select ON public.pipeline_events';
    EXECUTE format('CREATE POLICY pipeline_events_select ON public.pipeline_events FOR SELECT USING (%s)', v_biz);

    EXECUTE 'DROP POLICY IF EXISTS pipeline_events_insert ON public.pipeline_events';
    EXECUTE format('CREATE POLICY pipeline_events_insert ON public.pipeline_events FOR INSERT WITH CHECK (%s)', v_write);
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_deals  TO authenticated, service_role;
GRANT SELECT, INSERT                 ON public.pipeline_events TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RECÁLCULO DE ETAPA
--    La etapa se deriva de la REALIDAD (turno + banderas), no de transiciones
--    permitidas. Eso resuelve gratis los saltos de etapa y la re-entrada.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pipeline_recompute_stage(p_deal_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    d          public.pipeline_deals%ROWTYPE;
    a          public.appointments%ROWTYPE;
    v_stage    text;
BEGIN
    SELECT * INTO d FROM public.pipeline_deals WHERE id = p_deal_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- 'lost' es terminal: solo se sale de él manualmente.
    IF d.stage = 'lost' THEN RETURN 'lost'; END IF;

    IF d.appointment_id IS NOT NULL THEN
        SELECT * INTO a FROM public.appointments WHERE id = d.appointment_id;
    END IF;

    IF a.id IS NOT NULL THEN
        -- Hay turno: la realidad manda y pisa cualquier movimiento manual.
        IF a.status IN ('cancelled','no_show') THEN
            v_stage := CASE WHEN COALESCE(a.is_rescheduled, false)
                            THEN 'loyalty'      -- ya recuperado por el staff
                            ELSE 'recovery' END;
        ELSIF a.date_start < now() THEN
            -- Turno pasado no cancelado = atendido. No se usa el valor
            -- 'completed' del enum a propósito: su existencia real está en
            -- disputa entre la migración 020 y el CHECK de 20260420000000.
            v_stage := 'loyalty';
        ELSE
            v_stage := 'scheduled';
        END IF;
    ELSE
        -- Sin turno: mandan las banderas, salvo que el staff haya movido la
        -- tarjeta a mano entre las dos etapas blandas.
        IF d.stage_source = 'manual' AND d.stage IN ('discovery','negotiation') THEN
            v_stage := d.stage;
        ELSIF d.queried_slots THEN
            v_stage := 'negotiation';
        ELSE
            v_stage := 'discovery';
        END IF;
    END IF;

    IF v_stage IS DISTINCT FROM d.stage THEN
        UPDATE public.pipeline_deals
           SET stage = v_stage,
               -- al ganar la realidad, el override manual se desactiva
               stage_source = CASE WHEN a.id IS NOT NULL THEN 'auto' ELSE stage_source END
         WHERE id = p_deal_id;
    END IF;

    RETURN v_stage;
END $$;

-- El proyecto tiene ALTER DEFAULT PRIVILEGES que da EXECUTE directo (no vía
-- PUBLIC) a anon/authenticated/service_role en cada función nueva — mismo
-- hueco que Aud.#1 documentó (anon 24→3). "REVOKE ALL FROM PUBLIC" no alcanza
-- esos grants directos; hay que revocarlos explícitamente por rol.
REVOKE ALL ON FUNCTION public.pipeline_recompute_stage(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_recompute_stage(uuid) TO service_role;


-- ── Sincronización desde appointments ──────────────────────────────────────
-- CRÍTICO: este trigger NUNCA puede tumbar la creación de un turno. Todo el
-- cuerpo va envuelto en EXCEPTION WHEN OTHERS — el pipeline es secundario
-- frente a que el bot pueda agendar.

CREATE OR REPLACE FUNCTION public.pipeline_sync_from_appointment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deal_id uuid;
BEGIN
    BEGIN
        SELECT id INTO v_deal_id FROM public.pipeline_deals
         WHERE appointment_id = NEW.id LIMIT 1;

        IF v_deal_id IS NULL THEN
            -- Engancha el deal abierto que aún no tiene turno (el cliente venía
            -- de Descubrimiento/Negociación y por fin agendó).
            SELECT id INTO v_deal_id FROM public.pipeline_deals
             WHERE business_id = NEW.business_id
               AND patient_id  = NEW.patient_id
               AND closed_at IS NULL
               AND appointment_id IS NULL
             ORDER BY created_at DESC LIMIT 1;

            IF v_deal_id IS NOT NULL THEN
                UPDATE public.pipeline_deals
                   SET appointment_id = NEW.id, last_activity_at = now()
                 WHERE id = v_deal_id;
            ELSE
                -- Cliente sin deal abierto (o ya tiene uno con otro turno):
                -- se cierra el anterior y se abre el ciclo nuevo.
                UPDATE public.pipeline_deals
                   SET closed_at = now()
                 WHERE business_id = NEW.business_id
                   AND patient_id  = NEW.patient_id
                   AND closed_at IS NULL;

                INSERT INTO public.pipeline_deals
                    (business_id, patient_id, appointment_id, last_activity_at)
                VALUES (NEW.business_id, NEW.patient_id, NEW.id, now())
                RETURNING id INTO v_deal_id;
            END IF;
        ELSE
            UPDATE public.pipeline_deals
               SET last_activity_at = now() WHERE id = v_deal_id;
        END IF;

        PERFORM public.pipeline_recompute_stage(v_deal_id);

        INSERT INTO public.pipeline_events
            (business_id, deal_id, patient_id, event_type, source, summary, metadata)
        VALUES (NEW.business_id, v_deal_id, NEW.patient_id,
                CASE WHEN TG_OP = 'INSERT' THEN 'appointment_created' ELSE 'appointment_' || NEW.status END,
                CASE WHEN COALESCE(NEW.created_by,'dashboard') = 'bot' THEN 'bot' ELSE 'staff' END,
                NULL,
                jsonb_build_object('appointment_id', NEW.id, 'status', NEW.status));
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pipeline_sync_from_appointment falló (ignorado): %', SQLERRM;
    END;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pipeline_sync_appointment ON public.appointments;
CREATE TRIGGER trg_pipeline_sync_appointment
    AFTER INSERT OR UPDATE OF status, is_rescheduled, date_start ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.pipeline_sync_from_appointment();

-- Es una función de trigger: el motor la invoca internamente sin necesitar
-- EXECUTE. Nadie debe poder llamarla como RPC directo vía PostgREST.
REVOKE ALL ON FUNCTION public.pipeline_sync_from_appointment() FROM PUBLIC, anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. pipeline_touch — EL CONTRATO DE n8n
--    Una llamada, un parámetro. Busca-o-crea el deal, prende la bandera,
--    registra el evento y recalcula la etapa.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pipeline_touch(
    p_business_id uuid,
    p_patient_id  uuid,
    p_flag        text,
    p_summary     text  DEFAULT NULL,
    p_value       int   DEFAULT NULL,
    p_metadata    jsonb DEFAULT '{}'::jsonb
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

    -- Whitelist explícita. Sin SQL dinámico sobre el nombre de columna.
    IF p_flag NOT IN ('offered_services','offered_promo','queried_slots','slot_offered',
                      'reminder_sent','confirmed_by_user','survey_sent','review_requested',
                      'recovery_step','nps_score','activity') THEN
        RAISE EXCEPTION 'pipeline_touch: bandera desconocida "%"', p_flag;
    END IF;

    SELECT id INTO v_deal_id FROM public.pipeline_deals
     WHERE business_id = p_business_id AND patient_id = p_patient_id AND closed_at IS NULL
     LIMIT 1;

    IF v_deal_id IS NULL THEN
        INSERT INTO public.pipeline_deals (business_id, patient_id, last_activity_at)
        VALUES (p_business_id, p_patient_id, now())
        RETURNING id INTO v_deal_id;
    END IF;

    UPDATE public.pipeline_deals SET
        offered_services  = offered_services  OR (p_flag = 'offered_services'),
        offered_promo     = offered_promo     OR (p_flag = 'offered_promo'),
        queried_slots     = queried_slots     OR (p_flag IN ('queried_slots','slot_offered')),
        reminder_sent     = reminder_sent     OR (p_flag = 'reminder_sent'),
        confirmed_by_user = confirmed_by_user OR (p_flag = 'confirmed_by_user'),
        survey_sent       = survey_sent       OR (p_flag = 'survey_sent'),
        review_requested  = review_requested  OR (p_flag = 'review_requested'),
        recovery_step     = CASE WHEN p_flag = 'recovery_step'
                                 THEN LEAST(COALESCE(p_value, recovery_step + 1), 3)
                                 ELSE recovery_step END,
        nps_score         = CASE WHEN p_flag = 'nps_score' THEN p_value ELSE nps_score END,
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

-- Solo el bot. Nunca authenticated: no valida que el business_id sea del caller.
REVOKE ALL ON FUNCTION public.pipeline_touch(uuid,uuid,text,text,int,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_touch(uuid,uuid,text,text,int,jsonb) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. LECTURA DEL TABLERO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_pipeline_board(
    p_business_id uuid DEFAULT NULL,
    p_days        int  DEFAULT 90
)
RETURNS TABLE (
    deal_id uuid, patient_id uuid, appointment_id uuid,
    display_name text, phone text, human_takeover boolean,
    stage text, stage_source text, temperature text,
    service_name text, date_start timestamptz, appointment_status text,
    offered_services boolean, offered_promo boolean, queried_slots boolean,
    reminder_sent boolean, confirmed_by_user boolean, survey_sent boolean,
    review_requested boolean, recovery_step smallint, nps_score smallint,
    last_ai_action text, last_activity_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz uuid;
BEGIN
    -- Ownership-check (patrón del fix I-6): si el caller es staff autenticado,
    -- se fuerza SU negocio y se ignora el parámetro. service_role conserva el
    -- parámetro para poder consultar cualquier tenant.
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
            WHEN d.stage = 'scheduled'                                    THEN 'hot'
            WHEN d.last_activity_at > now() - interval '6 hours'           THEN 'hot'
            WHEN d.last_activity_at > now() - interval '48 hours'          THEN 'warm'
            ELSE 'cold'
        END::text,
        s.name::text, a.date_start, a.status::text,
        d.offered_services, d.offered_promo, d.queried_slots,
        d.reminder_sent, d.confirmed_by_user, d.survey_sent,
        d.review_requested, d.recovery_step, d.nps_score,
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


CREATE OR REPLACE FUNCTION public.get_pipeline_metrics(p_business_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_biz uuid;
    v_month_start timestamptz := date_trunc('month', now());
BEGIN
    v_biz := public.get_user_business_id();
    IF v_biz IS NULL THEN v_biz := p_business_id; END IF;
    IF v_biz IS NULL THEN RETURN '{}'::jsonb; END IF;

    RETURN jsonb_build_object(
        -- Citas cerradas por la IA este mes (created_by ya existía)
        'ai_booked', (
            SELECT count(*) FROM public.appointments
             WHERE business_id = v_biz AND created_by = 'bot'
               AND created_at >= v_month_start AND status <> 'cancelled'),
        -- Recuperados: turnos perdidos que el staff ya reagendó
        'recovered', (
            SELECT count(*) FROM public.appointments
             WHERE business_id = v_biz AND is_rescheduled = true
               AND updated_at >= v_month_start),
        'open_deals', (
            SELECT count(*) FROM public.pipeline_deals
             WHERE business_id = v_biz AND closed_at IS NULL AND stage <> 'lost'),
        'needs_human', (
            SELECT count(*) FROM public.pipeline_deals d
              JOIN public.patients p ON p.id = d.patient_id
             WHERE d.business_id = v_biz AND d.closed_at IS NULL
               AND p.human_takeover = true),
        -- Tiempo medio de respuesta de la IA (segundos), desde el log de eventos
        'avg_response_seconds', (
            SELECT COALESCE(round(avg(extract(epoch FROM gap)))::int, 0)
              FROM (
                SELECT e.created_at - lag(e.created_at) OVER (PARTITION BY e.deal_id ORDER BY e.created_at) AS gap
                  FROM public.pipeline_events e
                 WHERE e.business_id = v_biz AND e.created_at >= v_month_start
              ) t WHERE gap IS NOT NULL AND gap < interval '10 minutes')
    );
END $$;

REVOKE ALL ON FUNCTION public.get_pipeline_metrics(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pipeline_metrics(uuid) TO authenticated, service_role;


-- ── Movimiento manual (arrastrar entre las 2 etapas blandas) ───────────────

CREATE OR REPLACE FUNCTION public.set_pipeline_stage(p_deal_id uuid, p_stage text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz uuid; v_deal_biz uuid;
BEGIN
    IF p_stage NOT IN ('discovery','negotiation','lost') THEN
        RAISE EXCEPTION 'set_pipeline_stage: solo se puede mover a discovery, negotiation o lost. Las demás etapas las determina el turno.';
    END IF;

    v_biz := public.get_user_business_id();
    SELECT business_id INTO v_deal_biz FROM public.pipeline_deals WHERE id = p_deal_id;
    IF v_deal_biz IS NULL THEN RAISE EXCEPTION 'Deal inexistente'; END IF;
    IF v_biz IS NOT NULL AND v_deal_biz <> v_biz THEN
        RAISE EXCEPTION 'Deal de otro negocio';
    END IF;

    UPDATE public.pipeline_deals
       SET stage = p_stage, stage_source = 'manual', last_activity_at = now(),
           closed_at = CASE WHEN p_stage = 'lost' THEN now() ELSE closed_at END
     WHERE id = p_deal_id;

    INSERT INTO public.pipeline_events (business_id, deal_id, patient_id, event_type, source, summary)
    SELECT d.business_id, d.id, d.patient_id, 'stage_manual', 'staff', 'Movido a ' || p_stage
      FROM public.pipeline_deals d WHERE d.id = p_deal_id;

    RETURN p_stage;
END $$;

REVOKE ALL ON FUNCTION public.set_pipeline_stage(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_pipeline_stage(uuid,text) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. MANTENIMIENTO (cierra ciclos y limpia)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pipeline_maintenance()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Fidelización cumplida hace >30 días → ciclo cerrado
    UPDATE public.pipeline_deals
       SET closed_at = now()
     WHERE closed_at IS NULL AND stage = 'loyalty'
       AND last_activity_at < now() - interval '30 days';

    -- Sin actividad en 90 días → descartado
    UPDATE public.pipeline_deals
       SET stage = 'lost', closed_at = now()
     WHERE closed_at IS NULL
       AND stage IN ('discovery','negotiation')
       AND last_activity_at < now() - interval '90 days';
END $$;

REVOKE ALL ON FUNCTION public.pipeline_maintenance() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pipeline_maintenance() TO service_role;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('pipeline-maintenance')
          WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-maintenance');
        PERFORM cron.schedule('pipeline-maintenance', '40 3 * * *', 'SELECT public.pipeline_maintenance()');
    ELSE
        RAISE NOTICE 'pg_cron no disponible — agendar pipeline_maintenance() manualmente';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. BACKFILL — el tablero no puede nacer vacío
--    Un solo deal ABIERTO por cliente (lo exige el índice único), derivado de
--    su turno más reciente; si no tiene turno, de su conversación reciente.
-- ═══════════════════════════════════════════════════════════════════════════

-- 8.1 Desde el turno más reciente de cada paciente (últimos 90 días)
INSERT INTO public.pipeline_deals (business_id, patient_id, appointment_id, last_activity_at, created_at)
SELECT DISTINCT ON (a.business_id, a.patient_id)
       a.business_id, a.patient_id, a.id,
       GREATEST(COALESCE(a.updated_at, a.created_at), a.date_start),
       COALESCE(a.created_at, now())
  FROM public.appointments a
  JOIN public.patients p ON p.id = a.patient_id AND p.deleted_at IS NULL
 WHERE a.date_start >= now() - interval '90 days'
   AND NOT EXISTS (SELECT 1 FROM public.pipeline_deals d
                    WHERE d.patient_id = a.patient_id AND d.closed_at IS NULL)
 ORDER BY a.business_id, a.patient_id, a.date_start DESC
ON CONFLICT DO NOTHING;

-- 8.2 Clientes con conversación reciente pero sin turno → Descubrimiento /
--     Negociación. La heurística de profundidad (≥6 mensajes) es provisional:
--     la reemplaza la bandera real queried_slots cuando entre la fase n8n.
INSERT INTO public.pipeline_deals (business_id, patient_id, queried_slots, last_activity_at, created_at)
SELECT h.business_id, h.patient_id,
       (count(*) >= 6),
       max(h.created_at),
       min(h.created_at)
  FROM public.history h
  JOIN public.patients p ON p.id = h.patient_id AND p.deleted_at IS NULL
 WHERE h.created_at >= now() - interval '90 days'
   AND h.patient_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.pipeline_deals d
                    WHERE d.patient_id = h.patient_id AND d.closed_at IS NULL)
 GROUP BY h.business_id, h.patient_id
ON CONFLICT DO NOTHING;

-- 8.3 Etapa inicial de todo lo sembrado (equivalente set-based de
--     pipeline_recompute_stage — mucho más rápido que fila por fila)

-- Deals CON turno: manda el estado del turno
UPDATE public.pipeline_deals d
   SET stage = CASE
        WHEN a.status IN ('cancelled','no_show')
             AND COALESCE(a.is_rescheduled,false) = false THEN 'recovery'
        WHEN a.status IN ('cancelled','no_show')          THEN 'loyalty'
        WHEN a.date_start < now()                         THEN 'loyalty'
        ELSE 'scheduled' END
  FROM public.appointments a
 WHERE a.id = d.appointment_id
   AND d.closed_at IS NULL;

-- Deals SIN turno: manda la bandera
UPDATE public.pipeline_deals
   SET stage = CASE WHEN queried_slots THEN 'negotiation' ELSE 'discovery' END
 WHERE closed_at IS NULL AND appointment_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. FEATURE FLAG + REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.plans SET features = COALESCE(features,'{}'::jsonb) || '{"pipeline": true}'::jsonb
 WHERE tier IN ('pro','enterprise');
UPDATE public.plans SET features = COALESCE(features,'{}'::jsonb) || '{"pipeline": false}'::jsonb
 WHERE tier = 'basic';

-- Permiso RBAC para roles ya existentes (los nuevos los siembra onboard-tenant)
UPDATE public.staff_roles
   SET permissions = COALESCE(permissions,'{}'::jsonb) || '{"view_pipeline": true}'::jsonb
 WHERE permissions IS NOT NULL AND permissions ? 'view_patients';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pipeline_deals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_deals;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo agregar pipeline_deals a supabase_realtime: %', SQLERRM;
END $$;
