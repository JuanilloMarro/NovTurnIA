-- ============================================================
-- 021: Agregar flag is_rescheduled a appointments
-- Permite ocultar turnos de Seguimiento sin borrarlos físicamente.
-- ============================================================

ALTER TABLE appointments 
ADD COLUMN is_rescheduled BOOLEAN DEFAULT FALSE;

-- Comentario para n8n o futuros desarrolladores
COMMENT ON COLUMN appointments.is_rescheduled IS 'Indica si este turno (originalmente no-show o cancelado) ya fue reagendado por el personal.';
