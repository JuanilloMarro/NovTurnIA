-- =====================================================
-- NovTurnIA — Migración 023: Feature flags Finance y Supplies
-- =====================================================
--
-- Agrega dos nuevos feature flags al JSONB de plans:
--   finance:  acceso al módulo de Finanzas (Ingresos, Egresos, Resumen, Confirmaciones)
--   supplies: acceso al sub-módulo de Insumos y Recetas de Costo (BOM) — Enterprise only
--
-- Asignación de plan:
--   finance  → Pro y Enterprise
--   supplies → Solo Enterprise
-- =====================================================

UPDATE plans
SET features = features || '{"finance": false, "supplies": false}'::jsonb
WHERE tier = 'basic';

UPDATE plans
SET features = features || '{"finance": true, "supplies": false}'::jsonb
WHERE tier = 'pro';

UPDATE plans
SET features = features || '{"finance": true, "supplies": true}'::jsonb
WHERE tier = 'enterprise';
