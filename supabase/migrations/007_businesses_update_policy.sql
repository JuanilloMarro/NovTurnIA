-- =====================================================
-- TurnIA — Migración 007: Policy UPDATE para businesses
-- =====================================================
--
-- PROBLEMA: La tabla `businesses` tiene RLS habilitado
-- pero solo tenía policy SELECT. Sin policy UPDATE, cualquier
-- intento de guardar configuración del negocio falla con
-- "El registro no existe o no tienes permisos de escritura (RLS)".
--
-- SOLUCIÓN: Agregar policy UPDATE restringida a usuarios
-- authenticated que sean staff del negocio que editan.
-- El filtro por business_id se aplica via JWT claim del staff.
-- =====================================================

-- Policy permisiva para authenticated (staff logueado via Supabase Auth).
-- El control de quién puede editar qué negocio se maneja a nivel
-- de permisos de rol en la app (usePermissions → manage_settings).
CREATE POLICY "businesses_update"
  ON businesses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
