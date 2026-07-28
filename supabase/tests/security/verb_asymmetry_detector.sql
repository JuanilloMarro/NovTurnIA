-- =====================================================================
-- SECURITY REGRESSION · Detector general de asimetría entre verbos RLS
-- ---------------------------------------------------------------------
-- Clase de falla que caza (la de SEC-1):
--   Un gate de control (user_has_permission / is_business_active / has_feature)
--   presente en algún verbo de una tabla pero AUSENTE en una política de
--   escritura EXISTENTE (INSERT/UPDATE/DELETE) de la misma tabla.
--   En SEC-1 el gate manage_roles vivía en UPDATE y faltaba en INSERT y DELETE.
--
-- Alcance y límites deliberados:
--   * Se ignora "deny-by-default" (verbo sin ninguna política): un verbo sin
--     política ya está bloqueado, no es un hueco.
--   * Se comparan solo políticas PERMISSIVE (verificado: 0 RESTRICTIVE en public).
--     Si algún día se agregan políticas RESTRICTIVE, revisar la lógica de OR.
--   * El universo de gates fue verificado exhaustivo: las únicas funciones
--     referenciadas en las 109 políticas de `public` son get_user_business_id,
--     is_business_active, user_has_permission, has_feature y auth.uid.
--
-- Cómo se lee la salida:
--   verbs_with_gate          = verbos donde el gate SÍ aparece
--   write_verbs_missing_gate = verbos de escritura con política que NO lo llevan
--   Cada fila es un candidato a clasificar manualmente (hueco vs. by-design).
--
-- BASELINE ACEPTADO (2026-07-27, migración 20260728001251 aplicada):
--   Dos filas esperadas, ambas clasificadas como NO explotables:
--     1) ai_chat_messages · has_feature · [SELECT] / [DELETE]
--        SELECT exige el feature premium; DELETE no. Efecto máximo: un tenant
--        degradado borra SUS PROPIAS filas (business_id + staff_user_id=auth.uid()
--        siguen exigidos). Sin cruce de tenant ni escalación. = clase INF-12
--        (gate has_feature en escrituras premium). Priorizar con el orquestador.
--     2) history · is_business_active · [DELETE] / [INSERT]
--        Tabla append-only de historial. DELETE bloqueado en suspensión, INSERT no.
--        Dirección correcta para un log auditable (se sigue registrando, no se
--        puede borrar). By-design; sin cruce de tenant. Confirmar intención.
--   staff_users y staff_roles NO deben aparecer: si aparecen, SEC-1/COD-5 se
--   reabrió. Cualquier fila nueva fuera de las dos del baseline es un hallazgo.
-- =====================================================================
WITH pol AS (
  SELECT tablename, cmd,
         (coalesce(qual, '') || ' ' || coalesce(with_check, '')) AS expr
  FROM pg_policies
  WHERE schemaname = 'public'
),
gates(gate) AS (
  VALUES ('user_has_permission'), ('is_business_active'), ('has_feature')
),
hit AS (   -- por (tabla, verbo, gate): ¿ese verbo lleva el gate?
  SELECT p.tablename, p.cmd, g.gate,
         bool_or(p.expr ~ g.gate) AS verb_has_gate
  FROM pol p CROSS JOIN gates g
  GROUP BY p.tablename, p.cmd, g.gate
),
agg AS (
  SELECT tablename, gate,
         array_agg(cmd ORDER BY cmd) FILTER (WHERE verb_has_gate) AS verbs_with_gate,
         array_agg(cmd ORDER BY cmd) FILTER (
           WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE') AND NOT verb_has_gate
         ) AS write_verbs_missing_gate
  FROM hit
  GROUP BY tablename, gate
)
SELECT tablename, gate, verbs_with_gate, write_verbs_missing_gate
FROM agg
WHERE verbs_with_gate IS NOT NULL           -- el gate se usa en la tabla
  AND write_verbs_missing_gate IS NOT NULL   -- y algún verbo de escritura existente lo omite
ORDER BY tablename, gate;
