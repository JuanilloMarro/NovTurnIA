-- =====================================================
-- TurnIA — Step 3: Persistent Notifications
-- =====================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================

-- ─── 1. Create Notifications Table ───────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id integer REFERENCES businesses(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL, -- 'appointment', 'patient', 'system'
  title varchar(255) NOT NULL,
  message text,
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb, -- Extra data (ids, times, etc.)
  created_at timestamp with time zone DEFAULT now()
);

-- ─── 2. Enable RLS ───────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow reads (staff with correct business_id)
-- Note: Simplified for current anon-key architecture
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow updates (mark as read)
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow deletes (clear activity log)
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── 3. Automation Triggers ──────────────────────────

-- Helper function to generate notification for new appointment
CREATE OR REPLACE FUNCTION trg_notify_appointment()
RETURNS TRIGGER AS $$
DECLARE
    p_name TEXT;
    c_time TEXT;
    c_date TEXT;
BEGIN
    -- Get patient name
    SELECT display_name INTO p_name FROM users WHERE id = NEW.user_id;
    IF p_name IS NULL THEN p_name := 'Paciente'; END IF;

    -- Format time and date (date_start is already in local time)
    c_time := to_char(NEW.date_start, 'HH12:MI AM');
    c_date := to_char(NEW.date_start, 'DD Mon');

    INSERT INTO notifications (business_id, type, title, message, metadata)
    VALUES (
        NEW.business_id,
        'appointment',
        'Nuevo Turno Agendado',
        p_name || ' : ' || c_date || ' · ' || c_time,
        jsonb_build_object('appointment_id', NEW.id, 'user_id', NEW.user_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_appointment_insert ON appointments;
CREATE TRIGGER trg_after_appointment_insert
    AFTER INSERT ON appointments
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION trg_notify_appointment();

-- Helper function to generate notification for new patient
CREATE OR REPLACE FUNCTION trg_notify_patient()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (business_id, type, title, message, metadata)
    VALUES (
        NEW.business_id,
        'patient',
        'Nuevo Paciente Registrado',
        COALESCE(NEW.display_name, 'Nuevo Paciente'),
        jsonb_build_object('user_id', NEW.id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_patient_insert ON users;
CREATE TRIGGER trg_after_patient_insert
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trg_notify_patient();
