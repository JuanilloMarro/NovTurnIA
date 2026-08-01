-- INF-8 · Topes por rol para que un tenant no se coma el pool compartido.
--
-- ⚠️ EL DIAGNÓSTICO DEL BACKLOG ESTABA A MEDIAS. Decía "falta statement_timeout
-- e idle_in_transaction_session_timeout por rol". Medido antes de tocar:
--
--   anon           statement_timeout=3s          ← ya estaba (default de Supabase)
--   authenticated  statement_timeout=8s          ← ya estaba
--   authenticator  statement_timeout=8s, lock_timeout=8s
--   service_role   (sin ningún ajuste)           ← este sí es el hueco
--   idle_in_transaction_session_timeout = 0      ← desactivado para TODOS
--
-- O sea que `statement_timeout` ya existía donde importaba. Lo que falta de
-- verdad es (1) el timeout de transacción ociosa, que hoy está apagado y deja
-- que una transacción abierta retenga locks y una conexión del pool para
-- siempre, y (2) que `service_role` no tenga ningún límite — y es justo el rol
-- con el que entran el bot y las Edge Functions.
--
-- ELECCIÓN DE NÚMEROS, medida contra pg_stat_statements (4,443 consultas):
--   · pico máximo observado: 10,075 ms
--   · consultas sobre 20s: 0
--   · y las 7 que pasan de 5s son TODAS internas de Supabase (decodificación
--     WAL de realtime, listados de Studio), ninguna de la aplicación.
-- Por eso 30s en service_role es holgado: el triple del peor pico real, que
-- además ni siquiera es código nuestro. Deja lugar de sobra para
-- `export-tenant-data`, que es la operación legítima más pesada.
--
-- Aditivo y reversible: son ajustes de rol, no tocan datos ni esquema.

-- 1. Transacción ociosa: si alguien abre una transacción y se va, se corta.
--    60s es generoso para cualquier flujo real del dashboard.
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE anon          SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE service_role  SET idle_in_transaction_session_timeout = '60s';

-- 2. service_role no tenía techo de consulta: heredaba el default de 2 min.
--    Dos minutos de una sola consulta sobre un pool compartido es exactamente
--    el modo de fallo que INF-8 quería evitar.
ALTER ROLE service_role  SET statement_timeout = '30s';

-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ Los ajustes de rol se aplican al ABRIR la conexión. PostgREST mantiene un
-- pool, así que las conexiones ya abiertas siguen con los valores viejos hasta
-- que se reciclen. No hace falta hacer nada: se van renovando solas.
--
-- VERIFICADO tras aplicar:
--   anon           statement_timeout=3s | idle_in_transaction_session_timeout=30s
--   authenticated  statement_timeout=8s | idle_in_transaction_session_timeout=60s
--   service_role   idle_in_transaction_session_timeout=60s | statement_timeout=30s
--
-- ROLLBACK (vuelve exactamente al estado medido antes):
--   ALTER ROLE authenticated RESET idle_in_transaction_session_timeout;
--   ALTER ROLE anon          RESET idle_in_transaction_session_timeout;
--   ALTER ROLE service_role  RESET idle_in_transaction_session_timeout;
--   ALTER ROLE service_role  RESET statement_timeout;
-- ─────────────────────────────────────────────────────────────────────────────
