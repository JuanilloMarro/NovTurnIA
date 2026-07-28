-- ============================================================================
-- INF-2 — REVOKE EXECUTE ... FROM anon (superficie innecesaria)
-- ----------------------------------------------------------------------------
-- El backlog lista 6 funciones. Se revocan SOLO 3. Las otras 3 se dejan
-- deliberadamente abiertas, y el motivo importa más que el ítem:
--
--   `get_user_business_id()`, `is_business_active()` y `has_feature()` están
--   EMBEBIDAS en el USING/WITH CHECK de políticas RLS que aplican al rol
--   `public` (del cual `anon` es miembro): 31, 17 y 2 políticas respectivamente
--   (medido contra producción). Si `anon` pierde EXECUTE sobre ellas, esas
--   políticas no devuelven "0 filas": la consulta ABORTA con error de permisos.
--   Cambiar un 0-filas silencioso por un error es una regresión, no un
--   endurecimiento. Se dejan como están, documentadas.
--
-- Las 3 que sí se revocan no aparecen en NINGUNA política que alcance a `anon`
-- (verificado: `get_cash_sessions` y `get_payment_plans` en 0 políticas;
-- `user_has_permission` en 6, todas `TO authenticated`). Las dos de finanzas
-- son overloads nuevos que nacieron con permiso para PUBLIC.
--
-- Free tier (Contrato §4): reversible; rollback al pie. No toca datos.
-- ============================================================================

-- ⚠️ Se revoca de PUBLIC, no de `anon`. `REVOKE ... FROM anon` es un NO-OP acá:
-- `anon` no tiene grant propio, hereda de PUBLIC (la ACL mostraba `=X/postgres`).
-- Es la misma lección ya documentada en Completadas §1 ("el hueco real era
-- PUBLIC, del cual anon es miembro"). `authenticated` y `service_role`
-- conservan su GRANT explícito, así que la app y las Edge Functions no se tocan.
REVOKE EXECUTE ON FUNCTION public.get_cash_sessions(integer, integer)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_payment_plans(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(text)                 FROM PUBLIC;

-- ============================================================================
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.get_cash_sessions(integer, integer)       TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.get_payment_plans(text, integer, integer) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.user_has_permission(text)                 TO PUBLIC;
--
-- PENDIENTE (no cerrado acá, a propósito): las 3 funciones embebidas en
-- políticas `TO public`. Cerrarlas exige antes reescribir esas 50 políticas para
-- que no dependan de que `anon` pueda ejecutar la función — trabajo mayor, con
-- su propio probe de regresión. Ver nota de cabecera.
-- ============================================================================
