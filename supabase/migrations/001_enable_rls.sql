-- =====================================================
-- TurnIA — Step 1: Row Level Security (RLS)
-- =====================================================
-- Run this in: Supabase Dashboard → SQL Editor
--
-- STRATEGY:
--   • SELECT: Allow for anon role (reads are filtered
--     by business_id in the frontend queries)
--   • INSERT/DELETE on critical tables: Block for anon
--     → Force through Edge Functions (service_role)
--   • UPDATE on appointments: Allow for anon
--     (cancel/confirm use direct SDK calls)
--   • Edge Functions use SERVICE_ROLE key → bypass RLS
-- =====================================================

-- ─── 1. Enable RLS on all tables ─────────────────────

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- ─── 2. Policies: appointments ───────────────────────

-- Allow reads (filtered by business_id in frontend)
CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  TO anon, authenticated
  USING (true);

-- Block direct INSERT for anon → use Edge Function
-- (Edge Functions use service_role which bypasses RLS)
CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow UPDATE for anon (cancel/confirm via SDK)
CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- No DELETE policy → appointments can never be deleted
-- (handled by trigger as extra safety)

-- ─── 3. Policies: users (patients) ───────────────────

CREATE POLICY "users_select"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow INSERT for anon (bot creates patients)
CREATE POLICY "users_insert"
  ON users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow UPDATE for anon (edit patient name)
CREATE POLICY "users_update"
  ON users FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow DELETE for anon (admin deletes via frontend)
-- Business logic (only dentist can delete) is checked
-- in the Edge Function / frontend
CREATE POLICY "users_delete"
  ON users FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── 4. Policies: history (conversations) ───────────

CREATE POLICY "history_select"
  ON history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "history_insert"
  ON history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── 5. Policies: message_buffer ─────────────────────

CREATE POLICY "buffer_select"
  ON message_buffer FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "buffer_insert"
  ON message_buffer FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── 6. Policies: staff_users ────────────────────────

-- Allow reads (for login check and user list)
CREATE POLICY "staff_select"
  ON staff_users FOR SELECT
  TO anon, authenticated
  USING (true);

-- Block direct INSERT for anon → use Edge Function
-- (create-staff goes through manage-staff function)
-- No INSERT policy for anon = blocked

-- Block direct DELETE for anon → use Edge Function
-- No DELETE policy for anon = blocked

-- Block direct UPDATE for anon → use Edge Function
-- No UPDATE policy for anon = blocked

-- ─── 6. Policies: staff_roles ────────────────────────

CREATE POLICY "roles_select"
  ON staff_roles FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── 7. Policies: businesses ─────────────────────────

CREATE POLICY "businesses_select"
  ON businesses FOR SELECT
  TO anon, authenticated
  USING (true);

-- =====================================================
-- SUMMARY:
--   ✅ All tables have RLS enabled
--   ✅ SELECT allowed on all tables (for dashboard reads)
--   ✅ Appointments: INSERT blocked for anon (via Edge Function)
--   ✅ Appointments: UPDATE allowed (cancel/confirm)
--   ✅ Appointments: DELETE blocked (trigger prevents it too)
--   ✅ Staff: INSERT/UPDATE/DELETE blocked for anon
--      (managed through Edge Function with permission checks)
--   ✅ Edge Functions use SERVICE_ROLE → bypass all RLS
--
-- To verify RLS is active, run:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public';
-- =====================================================
