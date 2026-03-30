-- ============================================================
-- SEED COMPLETO: Multi-tenancy SaaS Demo
-- Ejecutar en Supabase SQL Editor (requiere permisos de service_role)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. NEGOCIOS (bid=2 Barbería, bid=3 Veterinaria, bid=4 Doctor)
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

-- Reset sequence para evitar conflictos
SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses));

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

-- Asegurar que el rol de dentista (bid=1) tenga delete_users
UPDATE staff_roles
SET permissions = permissions || '{"delete_users": true}'::jsonb
WHERE business_id = 1 AND name = 'dentist';

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
-- 4. CREAR USUARIOS AUTH (6 nuevos usuarios)
-- Se usa la extension pgcrypto para hashear passwords
-- ════════════════════════════════════════════════════════════

-- Barbero (main user)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'barbero@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Carlos El Patrón","business_id":2}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Secretaria Barbería
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'secretaria.barbero@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"María López","business_id":2}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Veterinario (main user)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'veterinario@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dr. Fernández","business_id":3}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Secretaria Veterinaria
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'secretaria.vet@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Andrea Ruiz","business_id":3}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Doctor (main user)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'doctor@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dr. Morales","business_id":4}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Secretaria Doctor
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'secretaria.doctor@novturnia.com',
  crypt('123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Laura Méndez","business_id":4}'::jsonb,
  ''
) ON CONFLICT (email) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 5. CREAR STAFF_USERS (vincular auth.users con roles)
-- ════════════════════════════════════════════════════════════

-- Asegurar que staff_users tiene columna email (puede no existir en schemas viejos)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS email VARCHAR;

-- Barbero → rol barber
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  2,
  (SELECT id FROM staff_roles WHERE business_id = 2 AND name = 'barber' LIMIT 1),
  'Carlos El Patrón',
  'barbero@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'barbero@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- Secretaria Barbería → rol secretary
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  2,
  (SELECT id FROM staff_roles WHERE business_id = 2 AND name = 'secretary' LIMIT 1),
  'María López',
  'secretaria.barbero@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'secretaria.barbero@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- Veterinario → rol veterinarian
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  3,
  (SELECT id FROM staff_roles WHERE business_id = 3 AND name = 'veterinarian' LIMIT 1),
  'Dr. Fernández',
  'veterinario@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'veterinario@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- Secretaria Veterinaria → rol secretary
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  3,
  (SELECT id FROM staff_roles WHERE business_id = 3 AND name = 'secretary' LIMIT 1),
  'Andrea Ruiz',
  'secretaria.vet@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'secretaria.vet@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- Doctor → rol doctor
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  4,
  (SELECT id FROM staff_roles WHERE business_id = 4 AND name = 'doctor' LIMIT 1),
  'Dr. Morales',
  'doctor@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'doctor@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- Secretaria Doctor → rol secretary
INSERT INTO staff_users (id, business_id, role_id, full_name, email, active)
SELECT
  au.id,
  4,
  (SELECT id FROM staff_roles WHERE business_id = 4 AND name = 'secretary' LIMIT 1),
  'Laura Méndez',
  'secretaria.doctor@novturnia.com',
  true
FROM auth.users au WHERE au.email = 'secretaria.doctor@novturnia.com'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true;

-- ════════════════════════════════════════════════════════════
-- 6. PACIENTES DE DEMO (5 por negocio nuevo)
-- ════════════════════════════════════════════════════════════

-- Barbería (bid=2) — 5 pacientes
INSERT INTO patients (business_id, display_name, email, notes) VALUES
(2, 'Roberto Martínez', 'roberto.m@email.com', 'Cliente frecuente, corte fade'),
(2, 'Diego Hernández', 'diego.h@email.com', 'Prefiere cita los sábados'),
(2, 'Andrés Soto', 'andres.s@email.com', 'Tiene alergia a ciertas ceras'),
(2, 'Fernando Reyes', 'fernando.r@email.com', 'Corte y barba cada 2 semanas'),
(2, 'Julio Castillo', 'julio.c@email.com', 'Nuevo cliente referido');

-- Veterinaria (bid=3) — 5 pacientes (mascotas/dueños)
INSERT INTO patients (business_id, display_name, email, notes) VALUES
(3, 'Max (Dueño: Ana García)', 'ana.garcia@email.com', 'Golden Retriever, 3 años, vacunas al día'),
(3, 'Luna (Dueño: Pedro López)', 'pedro.l@email.com', 'Gata siamesa, 2 años, esterilizada'),
(3, 'Rocky (Dueño: María Paz)', 'maria.paz@email.com', 'Bulldog francés, 5 años, problemas respiratorios'),
(3, 'Milo (Dueño: Carlos Ruiz)', 'carlos.ruiz@email.com', 'Labrador, 1 año, primera consulta'),
(3, 'Coco (Dueño: Laura Torres)', 'laura.t@email.com', 'Chihuahua, 4 años, control dental');

-- Doctor (bid=4) — 5 pacientes
INSERT INTO patients (business_id, display_name, email, notes) VALUES
(4, 'Ana María Rodríguez', 'anamaria.r@email.com', 'Hipertensión controlada, control mensual'),
(4, 'José Luis García', 'joseluis.g@email.com', 'Diabetes tipo 2, dieta controlada'),
(4, 'Patricia Moreno', 'patricia.m@email.com', 'Chequeo preventivo anual'),
(4, 'Ricardo Fuentes', 'ricardo.f@email.com', 'Seguimiento cardiológico'),
(4, 'Sofía Mendoza', 'sofia.mz@email.com', 'Primera consulta, referida');

-- Teléfonos de los pacientes
INSERT INTO patient_phones (patient_id, phone, is_primary)
SELECT id, '5021' || LPAD(FLOOR(RANDOM() * 9999999 + 1000000)::text, 7, '0'), true
FROM patients
WHERE business_id IN (2, 3, 4)
AND id NOT IN (SELECT patient_id FROM patient_phones);

-- ════════════════════════════════════════════════════════════
-- 7. VERIFICACIÓN
-- ════════════════════════════════════════════════════════════
-- Ejecuta estas queries para verificar:
-- SELECT * FROM businesses;
-- SELECT * FROM staff_roles WHERE business_id IN (2,3,4);
-- SELECT * FROM services WHERE business_id IN (2,3,4);
-- SELECT su.*, sr.name as role_name FROM staff_users su JOIN staff_roles sr ON su.role_id = sr.id WHERE su.business_id IN (2,3,4);
-- SELECT * FROM patients WHERE business_id IN (2,3,4);
