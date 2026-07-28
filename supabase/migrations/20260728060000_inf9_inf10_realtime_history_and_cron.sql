-- ============================================================================
-- INF-9 · INF-10 — Realtime sobre `history` y frecuencia del cron de limpieza
-- ----------------------------------------------------------------------------
-- INF-9: los mensajes ENTRANTES de WhatsApp no llegaban en vivo a Conversaciones
--   porque `history` no está en la publicación de realtime (verificado: solo
--   `appointments`, `notifications`, `patients`, `pipeline_deals`).
--   `history` está PARTICIONADA por mes, así que además hay que publicar por la
--   raíz (`publish_via_partition_root`): sin eso los eventos viajarían con el
--   nombre de la partición (`history_y2026m07`) y el cliente, que se suscribe a
--   `history`, no los recibiría. Las otras 4 tablas no están particionadas, así
--   que activar la opción no las afecta.
--
-- INF-10: `clean-message-buffer` corría CADA MINUTO. Medido en la auditoría:
--   20,160 de las 20,234 ejecuciones de 14 días eran de este job, casi siempre
--   sobre una tabla vacía. Pasa a cada 5 minutos. Es trabajo puramente de
--   limpieza (`DELETE FROM message_buffer WHERE expires_at < NOW()`): las filas
--   que borra YA están vencidas, así que espaciarlo no cambia la lógica del bot,
--   solo deja que un registro vencido viva hasta 5 minutos más.
--
-- Free tier (Contrato §4): ambos cambios reversibles; rollback al pie. No se
-- borran datos ni se toca esquema.
-- ============================================================================

-- ─── INF-9 ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime SET (publish_via_partition_root = true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.history;

-- ─── INF-10 ─────────────────────────────────────────────────────────────────
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'clean-message-buffer'),
  schedule => '*/5 * * * *'
);

-- ============================================================================
-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.history;
--   ALTER PUBLICATION supabase_realtime SET (publish_via_partition_root = false);
--   SELECT cron.alter_job(
--     (SELECT jobid FROM cron.job WHERE jobname = 'clean-message-buffer'),
--     schedule => '* * * * *');
-- ============================================================================
