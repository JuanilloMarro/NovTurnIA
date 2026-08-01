-- B3 · Cupos v3, derivados del modelo de negocio (pacientes × 15 mensajes).
--
-- SEGURIDAD ANTES DE APLICAR: se midió el consumo real de los 3 negocios.
-- El máximo es 22 mensajes salientes en el mes contra un cupo nuevo de 6,750,
-- y el negocio con más pacientes tiene 6 contra un cupo nuevo de 450. Ningún
-- cliente queda por encima de su cupo nuevo, así que nadie pierde el bot.
-- Si esto se re-aplicara en el futuro con clientes más grandes, hay que volver
-- a medir: max_conversations BAJA para Pro (5,000→3,000) y Enterprise
-- (20,000→6,750), y max_patients le pone techo a Enterprise (∞→450).
--
-- Solo toca datos de `plans`, no el esquema. `limit_overrides` por negocio
-- sigue funcionando igual y es la vía de escape si alguien necesita más.

UPDATE plans SET
    max_conversations        = 1050,
    max_patients             = 70,
    history_retention_months = 3
WHERE name = 'Básico';

UPDATE plans SET
    max_conversations        = 3000,
    max_patients             = 200,
    history_retention_months = 6   -- 3→6: es el único que SUBE de retención
WHERE name = 'Pro';

UPDATE plans SET
    max_conversations        = 6750,
    max_patients             = 450,  -- antes NULL (ilimitado)
    history_retention_months = 12
WHERE name = 'Enterprise';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (valores exactos medidos en producción antes de este cambio):
--
-- UPDATE plans SET max_conversations = 500,   max_patients = 50,
--                  history_retention_months = 3  WHERE name = 'Básico';
-- UPDATE plans SET max_conversations = 5000,  max_patients = 150,
--                  history_retention_months = 3  WHERE name = 'Pro';
-- UPDATE plans SET max_conversations = 20000, max_patients = NULL,
--                  history_retention_months = 12 WHERE name = 'Enterprise';
-- ─────────────────────────────────────────────────────────────────────────────
