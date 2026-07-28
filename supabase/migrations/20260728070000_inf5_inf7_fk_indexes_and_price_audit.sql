-- ============================================================================
-- INF-5 · INF-7 — Índices de cobertura en claves foráneas y auditoría de precios
-- ----------------------------------------------------------------------------
-- INF-5: 10 claves foráneas sin índice de cobertura (verificado contra
--   producción: son exactamente las 10 que lista el backlog). Sin índice, cada
--   verificación de la FK y cada join por esa columna hace scan secuencial, y un
--   DELETE en la tabla padre debe recorrer toda la hija.
--   Por qué vale la pena y no es "índice por si acaso": la prueba de carga de la
--   auditoría (Completadas §2) midió que **el índice pesa 69× más que el patrón
--   de política** — sin índice, 172 ms vs 1,319 ms; con índice, el InitPlan pasa
--   a ser irrelevante. El índice es la palanca real de rendimiento.
--
-- INF-7: `services` y `offers` son las dos tablas donde vive el PRECIO y no
--   dejaban ningún rastro, mientras `supplies` y `payment_methods` sí auditan.
--   Se replica exactamente el mismo cableado ya probado en producción:
--   AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW EXECUTE trigger_audit_log().
--
-- Free tier (Contrato §4): 100% aditivo (CREATE INDEX / CREATE TRIGGER), sin
-- borrar ni reescribir nada. Rollback al pie.
-- ============================================================================

-- ─── INF-5: índices de cobertura ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_staff_user_id   ON public.ai_chat_messages (staff_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_generated_by         ON public.ai_insights (generated_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by          ON public.cash_sessions (opened_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_closed_by          ON public.cash_sessions (closed_by);
CREATE INDEX IF NOT EXISTS idx_income_entries_staff_id          ON public.income_entries (staff_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_patient_id         ON public.payment_plans (patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_created_by         ON public.payment_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_patient_id      ON public.payment_vouchers (patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_redeemed_income ON public.payment_vouchers (redeemed_income_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_patient_id       ON public.pipeline_events (patient_id);

-- ─── INF-7: auditoría en las tablas de precio ───────────────────────────────
DROP TRIGGER IF EXISTS audit_services ON public.services;
CREATE TRIGGER audit_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

DROP TRIGGER IF EXISTS audit_offers ON public.offers;
CREATE TRIGGER audit_offers
  AFTER INSERT OR UPDATE OR DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS audit_services ON public.services;
--   DROP TRIGGER IF EXISTS audit_offers   ON public.offers;
--   DROP INDEX IF EXISTS public.idx_ai_chat_messages_staff_user_id;
--   DROP INDEX IF EXISTS public.idx_ai_insights_generated_by;
--   DROP INDEX IF EXISTS public.idx_cash_sessions_opened_by;
--   DROP INDEX IF EXISTS public.idx_cash_sessions_closed_by;
--   DROP INDEX IF EXISTS public.idx_income_entries_staff_id;
--   DROP INDEX IF EXISTS public.idx_payment_plans_patient_id;
--   DROP INDEX IF EXISTS public.idx_payment_plans_created_by;
--   DROP INDEX IF EXISTS public.idx_payment_vouchers_patient_id;
--   DROP INDEX IF EXISTS public.idx_payment_vouchers_redeemed_income;
--   DROP INDEX IF EXISTS public.idx_pipeline_events_patient_id;
-- ============================================================================
