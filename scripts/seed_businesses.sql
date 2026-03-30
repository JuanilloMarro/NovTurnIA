-- ============================================================
-- SEED: 3 nuevos negocios para demostrar multi-tenancy SaaS
-- Barbero (bid=2), Veterinario (bid=3), Doctor (bid=4)
-- Cada uno con: main user + secretaria + 5 servicios
-- ============================================================

-- ▸ IMPORTANTE: Ejecutar en Supabase SQL Editor
-- Los usuarios de auth se crean por separado via supabase.auth.admin.createUser()
-- o via la Edge Function / Dashboard de Supabase Auth

-- ════════════════════════════════════════════════════════════
-- 1. NEGOCIOS
-- ════════════════════════════════════════════════════════════

INSERT INTO businesses (id, name, phone_number_id, schedule_start, schedule_end, schedule_days, appointment_duration, timezone, plan, active)
VALUES
  (2, 'Barbería El Patrón', 'wa_barbero_001', 9, 19, 'Lun-Sáb', 30, 'America/Guatemala', 'pro', true),
  (3, 'Veterinaria PetCare', 'wa_vet_001', 8, 17, 'Lun-Vie', 30, 'America/Guatemala', 'pro', true),
  (4, 'Consultorio Dr. Morales', 'wa_doctor_001', 8, 18, 'Lun-Vie', 30, 'America/Guatemala', 'pro', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone_number_id = EXCLUDED.phone_number_id,
  schedule_start = EXCLUDED.schedule_start,
  schedule_end = EXCLUDED.schedule_end,
  schedule_days = EXCLUDED.schedule_days,
  appointment_duration = EXCLUDED.appointment_duration,
  timezone = EXCLUDED.timezone,
  plan = EXCLUDED.plan,
  active = EXCLUDED.active;

-- ════════════════════════════════════════════════════════════
-- 2. ROLES POR NEGOCIO
-- ════════════════════════════════════════════════════════════

-- Barbería (bid=2)
INSERT INTO staff_roles (business_id, name, permissions) VALUES
(2, 'barber', '{
  "view_stats": true,
  "manage_roles": true,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": true,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": true,
  "delete_patients": true,
  "view_conversations": true,
  "toggle_ai": true,
  "delete_users": true
}'::jsonb),
(2, 'secretary', '{
  "view_stats": false,
  "manage_roles": false,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": false,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": false,
  "delete_patients": false,
  "view_conversations": true,
  "toggle_ai": false,
  "delete_users": false
}'::jsonb);

-- Veterinaria (bid=3)
INSERT INTO staff_roles (business_id, name, permissions) VALUES
(3, 'veterinarian', '{
  "view_stats": true,
  "manage_roles": true,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": true,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": true,
  "delete_patients": true,
  "view_conversations": true,
  "toggle_ai": true,
  "delete_users": true
}'::jsonb),
(3, 'secretary', '{
  "view_stats": false,
  "manage_roles": false,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": false,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": false,
  "delete_patients": false,
  "view_conversations": true,
  "toggle_ai": false,
  "delete_users": false
}'::jsonb);

-- Doctor (bid=4)
INSERT INTO staff_roles (business_id, name, permissions) VALUES
(4, 'doctor', '{
  "view_stats": true,
  "manage_roles": true,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": true,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": true,
  "delete_patients": true,
  "view_conversations": true,
  "toggle_ai": true,
  "delete_users": true
}'::jsonb),
(4, 'secretary', '{
  "view_stats": false,
  "manage_roles": false,
  "create_appointments": true,
  "edit_appointments": true,
  "confirm_appointments": true,
  "delete_appointments": false,
  "view_patients": true,
  "create_patients": true,
  "edit_patients": false,
  "delete_patients": false,
  "view_conversations": true,
  "toggle_ai": false,
  "delete_users": false
}'::jsonb);

-- ════════════════════════════════════════════════════════════
-- 3. SERVICIOS POR NEGOCIO
-- ════════════════════════════════════════════════════════════

-- Barbería (bid=2) — 5 servicios
INSERT INTO services (business_id, name, description, duration_minutes, mode, active) VALUES
(2, 'Corte Clásico', 'Corte de cabello tradicional con tijera y máquina', 30, 'auto', true),
(2, 'Barba Completa', 'Recorte y diseño de barba con navaja y toalla caliente', 30, 'auto', true),
(2, 'Corte + Barba', 'Combo completo de corte de cabello más arreglo de barba', 60, 'auto', true),
(2, 'Diseño de Cejas', 'Perfilado y diseño de cejas masculinas', 30, 'auto', true),
(2, 'Tratamiento Capilar', 'Hidratación y tratamiento para cabello y cuero cabelludo', 60, 'auto', true);

-- Veterinaria (bid=3) — 5 servicios
INSERT INTO services (business_id, name, description, duration_minutes, mode, active) VALUES
(3, 'Consulta General', 'Evaluación general de salud del animal', 30, 'auto', true),
(3, 'Vacunación', 'Aplicación de vacunas según esquema de la mascota', 30, 'auto', true),
(3, 'Desparasitación', 'Tratamiento antiparasitario interno y externo', 30, 'auto', true),
(3, 'Cirugía Menor', 'Procedimientos quirúrgicos menores (esterilización, etc)', 90, 'eval', true),
(3, 'Baño y Grooming', 'Baño completo, corte de uñas y limpieza de oídos', 60, 'auto', true);

-- Doctor (bid=4) — 5 servicios
INSERT INTO services (business_id, name, description, duration_minutes, mode, active) VALUES
(4, 'Consulta General', 'Evaluación médica general y diagnóstico', 30, 'auto', true),
(4, 'Chequeo Preventivo', 'Examen completo de salud preventiva', 60, 'auto', true),
(4, 'Control de Presión', 'Medición y seguimiento de presión arterial', 30, 'auto', true),
(4, 'Electrocardiograma', 'Estudio de actividad eléctrica del corazón', 60, 'eval', true),
(4, 'Consulta Especializada', 'Consulta con enfoque en medicina interna', 60, 'auto', true);

-- ════════════════════════════════════════════════════════════
-- 4. USUARIOS AUTH + STAFF_USERS
-- ════════════════════════════════════════════════════════════
-- 
-- NOTA IMPORTANTE: Los usuarios de auth.users se deben crear
-- desde el Dashboard de Supabase > Authentication > Users
-- o via supabase.auth.admin.createUser()
--
-- Credenciales planificadas:
--
-- ┌──────────────────────────┬──────────────────────────────────┬──────────┬─────┐
-- │ Negocio                  │ Email                            │ Password │ BID │
-- ├──────────────────────────┼──────────────────────────────────┼──────────┼─────┤
-- │ Barbería - Main          │ barbero@novturnia.com             │ 123456   │ 2   │
-- │ Barbería - Secretaria    │ secretaria.barbero@novturnia.com  │ 123456   │ 2   │
-- │ Veterinaria - Main       │ veterinario@novturnia.com         │ 123456   │ 3   │
-- │ Veterinaria - Secretaria │ secretaria.vet@novturnia.com      │ 123456   │ 3   │
-- │ Doctor - Main            │ doctor@novturnia.com              │ 123456   │ 4   │
-- │ Doctor - Secretaria      │ secretaria.doctor@novturnia.com   │ 123456   │ 4   │
-- └──────────────────────────┴──────────────────────────────────┴──────────┴─────┘
--
-- Después de crearlos en auth, usar los UUIDs generados para
-- insertar en staff_users (ver script create_staff_users.sql)
-- ════════════════════════════════════════════════════════════
