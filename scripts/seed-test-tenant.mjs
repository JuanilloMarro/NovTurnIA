#!/usr/bin/env node
// scripts/seed-test-tenant.mjs — negocio semilla para QA (idempotente)
// ═══════════════════════════════════════════════════════════════════════════
// Qué hace
// --------
// Puebla el NEGOCIO SEMILLA (un tenant real y aislado, `business_id` propio,
// dentro del ÚNICO proyecto Supabase que existe — este SaaS está en free tier,
// sin branching) con datos realistas para que el harness de Playwright tenga
// algo que mostrar en los 9 módulos: servicios, pacientes, turnos en varios
// estados, ingresos, egresos, y (vía el trigger `pipeline_sync_from_appointment`)
// al menos un deal en el Pipeline.
//
// Reusa EXCLUSIVAMENTE los mismos caminos que usaría una persona logueada en
// el dashboard: RPC `create_patient_with_phone`, e inserts/updates a
// `appointments`/`income_entries`/`expense_entries` con la misma forma exacta
// que `src/services/supabaseService.js` (createAppointment, recordIncome,
// recordExpense, confirmAppointment, markNoShow, cancelAppointment). Ninguna
// escritura salta triggers: corre autenticado con la anon key, sujeto a RLS,
// nunca con la service_role.
//
// Idempotencia
// ------------
// Cada entidad se busca por una clave natural antes de insertar:
//   - servicios   → por `name`
//   - pacientes   → por teléfono (`patient_phones.phone`, prefijo +502 5555-01xx,
//                   un rango reservado para datos ficticios, nunca asignado)
//   - turnos      → por (patient_id, service_id) — un turno por combinación
//   - ingresos/egresos → por `description` exacta (marcada `[QA Seed]`)
// Correr el script dos veces no duplica nada; solo rellena lo que falte.
//
// Requiere en `.env.test` (ver `.env.test.example`):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD   → login real del owner del negocio semilla
//   SEED_BUSINESS_ID (opcional)             → si está, se usa como guarda de seguridad:
//                                              si no coincide con el business_id real
//                                              del owner logueado, el script ABORTA.
//
// Uso: npm run test:seed
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
    process.loadEnvFile(path.join(__dirname, '..', '.env.test'));
} catch {
    // .env.test no existe todavía — seguimos, la validación de abajo explica qué falta.
}

const {
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY,
    SEED_BUSINESS_ID,
    SEED_OWNER_EMAIL,
    SEED_OWNER_PASSWORD,
} = process.env;

function die(msg) {
    console.error(`\n[seed] BLOQUEADO — ${msg}\n`);
    process.exit(1);
}

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    die('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.test (copiá .env.test.example).');
}
if (!SEED_OWNER_EMAIL || !SEED_OWNER_PASSWORD) {
    die(
        'Faltan SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD en .env.test.\n' +
        'Este script necesita loguearse como el owner real del negocio semilla — no crea el ' +
        'negocio ni el usuario por su cuenta (eso requiere el flujo /admin/new-tenant, exclusivo ' +
        'del super-admin). Ver el reporte del agente qa-e2e para el paso manual pendiente.'
    );
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

// ── Datos semilla (fijos y deterministas — no random, para que sea idempotente) ──

// duration_minutes debe ser múltiplo de 30 — constraint chk_duration_minutes.
const SERVICES = [
    { name: 'Consulta general', description: 'Evaluación y diagnóstico inicial', duration_minutes: 30, price: 150 },
    { name: 'Limpieza dental', description: 'Profilaxis y remoción de sarro', duration_minutes: 60, price: 250 },
    { name: 'Extracción simple', description: 'Extracción de pieza dental sin complicaciones', duration_minutes: 30, price: 300 },
    { name: 'Blanqueamiento dental', description: 'Tratamiento estético de blanqueamiento', duration_minutes: 60, price: 600 },
];

// Rango +502 5555-01xx: prefijo reservado para datos ficticios, nunca se
// asigna a números reales — igual que el 555 estadounidense.
const PATIENTS = [
    { display_name: 'Ana Lucía Morales', phone: '+50255550101' },
    { display_name: 'Carlos Enrique Pérez', phone: '+50255550102' },
    { display_name: 'María José Fernández', phone: '+50255550103' },
    { display_name: 'Diego Alejandro Ramírez', phone: '+50255550104' },
    { display_name: 'Sofía Isabel Castillo', phone: '+50255550105' },
    { display_name: 'Jorge Mario Aguilar', phone: '+50255550106' },
];

const SEED_MARK = '[QA Seed]';

function log(msg) { console.log(`[seed] ${msg}`); }

// ── Helpers de fecha: próximo día hábil (Lun–Vie) N días hábiles a partir de hoy ──
function nextBusinessDay(fromDate, businessDays) {
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    // 0=Dom..6=Sáb → nuestro schedule_days usa 1..7 (Lun..Dom) en la app, pero
    // para simplificar el seed asumimos Lun–Vie si no hay dato mejor.
    const allowed = businessDays && businessDays.length ? businessDays : [1, 2, 3, 4, 5];
    while (!allowed.includes(d.getDay() === 0 ? 7 : d.getDay())) {
        d.setDate(d.getDate() + 1);
    }
    return d;
}

function atHour(date, hour, minute = 0) {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

async function main() {
    log(`Autenticando como owner (${SEED_OWNER_EMAIL})...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: SEED_OWNER_EMAIL,
        password: SEED_OWNER_PASSWORD,
    });
    if (authError) die(`Login falló: ${authError.message}`);

    const { data: staffProfile, error: profileError } = await supabase
        .from('staff_users')
        .select('id, business_id, active, staff_roles(name)')
        .eq('id', authData.user.id)
        .maybeSingle();
    if (profileError) die(`Error leyendo staff_users: ${profileError.message}`);
    if (!staffProfile || !staffProfile.active) {
        die('El usuario logueado no tiene un staff_users activo. ¿Es realmente el owner del negocio semilla?');
    }

    const businessId = staffProfile.business_id;
    if (SEED_BUSINESS_ID && SEED_BUSINESS_ID !== businessId) {
        die(
            `GUARDA DE SEGURIDAD: SEED_BUSINESS_ID en .env.test (${SEED_BUSINESS_ID}) no coincide con ` +
            `el business_id real del owner logueado (${businessId}). Abortando para no sembrar datos ` +
            `en el negocio equivocado — corregí .env.test.`
        );
    }
    log(`business_id = ${businessId} (rol: ${staffProfile.staff_roles?.name ?? '¿?'})`);

    // ── Servicios ────────────────────────────────────────────────────────────
    const { data: existingServices, error: svcReadErr } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes')
        .eq('business_id', businessId);
    if (svcReadErr) die(`Error leyendo services: ${svcReadErr.message}`);

    const svcByName = new Map((existingServices || []).map(s => [s.name.toLowerCase(), s]));
    for (const svc of SERVICES) {
        if (svcByName.has(svc.name.toLowerCase())) {
            log(`  servicio ya existe: "${svc.name}" — omitido`);
            continue;
        }
        const { data, error } = await supabase
            .from('services')
            .insert({ business_id: businessId, ...svc, active: true })
            .select('id, name, price, duration_minutes')
            .single();
        if (error) die(`Error creando servicio "${svc.name}": ${error.message}`);
        svcByName.set(svc.name.toLowerCase(), data);
        log(`  + servicio creado: "${svc.name}"`);
    }

    // ── Pacientes (RPC create_patient_with_phone — atómica patient+phone) ──────
    const { data: existingPhones, error: phoneReadErr } = await supabase
        .from('patient_phones')
        .select('phone, patient_id, patients!inner(id, display_name, business_id)')
        .eq('business_id', businessId)
        .in('phone', PATIENTS.map(p => p.phone));
    if (phoneReadErr) die(`Error leyendo patient_phones: ${phoneReadErr.message}`);

    const patientByPhone = new Map((existingPhones || []).map(r => [r.phone, { id: r.patient_id, display_name: r.patients.display_name }]));
    for (const p of PATIENTS) {
        if (patientByPhone.has(p.phone)) {
            log(`  paciente ya existe: "${p.display_name}" — omitido`);
            continue;
        }
        const { data: patientId, error } = await supabase.rpc('create_patient_with_phone', {
            p_business_id: businessId,
            p_display_name: p.display_name,
            p_phone: p.phone,
        });
        if (error) die(`Error creando paciente "${p.display_name}": ${error.message}`);
        patientByPhone.set(p.phone, { id: patientId, display_name: p.display_name });
        log(`  + paciente creado: "${p.display_name}"`);
    }
    const patients = PATIENTS.map(p => patientByPhone.get(p.phone));

    // ── Horario del negocio (para no chocar con validate_appointment) ──────────
    const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select('schedule_start, schedule_end, schedule_days')
        .eq('id', businessId)
        .single();
    if (bizErr) die(`Error leyendo businesses: ${bizErr.message}`);

    const DAY_MAP = { Dom: 7, Lun: 1, Mar: 2, Mié: 3, Jue: 4, Vie: 5, Sáb: 6 };
    const businessDays = (business.schedule_days || 'Lun,Mar,Mié,Jue,Vie')
        .split(',').map(d => DAY_MAP[d.trim()]).filter(Boolean);
    const safeHour = Math.max(business.schedule_start ?? 9, 9);

    const today = new Date();

    // ── Turnos en varios estados ────────────────────────────────────────────
    // patients[0..5] ya están garantizados (6 pacientes, 4 servicios → ciclamos).
    const svcList = [...svcByName.values()];
    const plan = [
        { label: 'scheduled (futuro)', patientIdx: 0, svcIdx: 0, day: addDays(today, 4), status: 'scheduled' },
        { label: 'confirmed (futuro)', patientIdx: 1, svcIdx: 1, day: addDays(today, 6), status: 'confirmed' },
        { label: 'completed (pasado, con ingreso)', patientIdx: 2, svcIdx: 2, day: addDays(today, -3), status: 'completed' },
        { label: 'no_show (pasado)', patientIdx: 3, svcIdx: 3, day: addDays(today, -5), status: 'no_show' },
        { label: 'cancelled (pasado)', patientIdx: 4, svcIdx: 0, day: addDays(today, -2), status: 'cancelled' },
        { label: 'scheduled #2 (futuro)', patientIdx: 5, svcIdx: 1, day: addDays(today, 8), status: 'scheduled' },
    ];

    const { data: existingAppts, error: apptReadErr } = await supabase
        .from('appointments')
        .select('id, patient_id, service_id, status')
        .eq('business_id', businessId);
    if (apptReadErr) die(`Error leyendo appointments: ${apptReadErr.message}`);
    const apptKey = (patientId, serviceId) => `${patientId}::${serviceId}`;
    const apptByKey = new Map((existingAppts || []).map(a => [apptKey(a.patient_id, a.service_id), a]));

    for (const step of plan) {
        const patient = patients[step.patientIdx];
        const service = svcList[step.svcIdx];
        const key = apptKey(patient.id, service.id);
        if (apptByKey.has(key)) {
            log(`  turno ya existe: ${step.label} (${patient.display_name} / ${service.name}) — omitido`);
            // Idempotencia con dientes: si el turno YA existía pero es el
            // "completed" y todavía no tiene ingreso confirmado (p. ej. una
            // corrida anterior falló después de crear el turno), completamos
            // el paso que falta en vez de saltarlo entero.
            if (step.status === 'completed') {
                const existingAppt = apptByKey.get(key);
                const { data: existingIncomeForAppt } = await supabase
                    .from('income_entries')
                    .select('id')
                    .eq('business_id', businessId)
                    .eq('appointment_id', existingAppt.id)
                    .eq('source', 'appointment')
                    .in('status', ['pending', 'confirmed'])
                    .maybeSingle();
                if (!existingIncomeForAppt) {
                    const { error: incomeErr } = await supabase.rpc('confirm_service_delivery', {
                        p_appointment_id: existingAppt.id,
                        p_amount: service.price,
                        p_payment_method: 'cash',
                        p_notes: SEED_MARK,
                    });
                    if (incomeErr) log(`    ! confirm_service_delivery falló (retry): ${incomeErr.message}`);
                    else log('    + ingreso confirmado para el turno completado (retry)');
                }
            }
            continue;
        }

        const day = nextBusinessDay(step.day, businessDays);
        const startHour = safeHour + 1; // margen contra el borde exacto de apertura
        const dateStart = atHour(day, startHour, 0);
        const dateEnd = new Date(dateStart.getTime() + (service.duration_minutes || 30) * 60_000);

        const { data: appt, error: insErr } = await supabase
            .from('appointments')
            .insert({
                business_id: businessId,
                patient_id: patient.id,
                service_id: service.id,
                date_start: dateStart.toISOString(),
                date_end: dateEnd.toISOString(),
                status: 'scheduled',
                created_by: 'dashboard',
                confirmed: false,
            })
            .select('id')
            .single();
        if (insErr) {
            log(`  ! no se pudo crear turno "${step.label}" (${patient.display_name}/${service.name}): ${insErr.message} — saltando`);
            continue;
        }
        log(`  + turno creado: ${step.label} (${patient.display_name} / ${service.name})`);

        // Llevar el turno al estado objetivo con las MISMAS transiciones que
        // usa el dashboard (supabaseService.js: confirmAppointment / markNoShow /
        // cancelAppointment). "completed" no tiene wrapper dedicado — se marca
        // igual que las demás, con un UPDATE acotado por business_id.
        if (step.status === 'confirmed') {
            await supabase.from('appointments').update({ confirmed: true, status: 'confirmed' }).eq('id', appt.id).eq('business_id', businessId);
        } else if (step.status === 'no_show') {
            await supabase.from('appointments').update({ status: 'no_show' }).eq('id', appt.id).eq('business_id', businessId);
        } else if (step.status === 'cancelled') {
            await supabase.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', appt.id).eq('business_id', businessId);
        } else if (step.status === 'completed') {
            await supabase.from('appointments').update({ confirmed: true, status: 'completed' }).eq('id', appt.id).eq('business_id', businessId);
            // Cobro real del turno vía la RPC que usa Finanzas → confirmar entrega.
            const { error: incomeErr } = await supabase.rpc('confirm_service_delivery', {
                p_appointment_id: appt.id,
                p_amount: service.price,
                p_payment_method: 'cash',
                p_notes: SEED_MARK,
            });
            if (incomeErr) log(`    ! confirm_service_delivery falló: ${incomeErr.message}`);
            else log('    + ingreso confirmado para el turno completado');
        }
    }

    // ── Ingreso manual (walk-in, sin turno) ─────────────────────────────────
    const manualIncomeDesc = `${SEED_MARK} Venta de kit de higiene dental`;
    const { data: existingIncome } = await supabase
        .from('income_entries')
        .select('id')
        .eq('business_id', businessId)
        .eq('description', manualIncomeDesc)
        .maybeSingle();
    if (existingIncome) {
        log('  ingreso manual ya existe — omitido');
    } else {
        const { error } = await supabase.from('income_entries').insert({
            business_id: businessId,
            source: 'manual',
            description: manualIncomeDesc,
            amount: 85,
            quantity: 1,
            payment_method: 'cash',
            occurred_at: addDays(today, -1).toISOString(),
            notes: SEED_MARK,
        });
        if (error) log(`  ! error creando ingreso manual: ${error.message}`);
        else log('  + ingreso manual creado');
    }

    // ── Egresos ──────────────────────────────────────────────────────────────
    const expenses = [
        { description: `${SEED_MARK} Insumos dentales del mes`, amount: 450, category: 'supplies' },
        { description: `${SEED_MARK} Alquiler del local`, amount: 3500, category: 'rent' },
    ];
    for (const exp of expenses) {
        const { data: existingExpense } = await supabase
            .from('expense_entries')
            .select('id')
            .eq('business_id', businessId)
            .eq('description', exp.description)
            .maybeSingle();
        if (existingExpense) {
            log(`  egreso ya existe: "${exp.description}" — omitido`);
            continue;
        }
        const { error } = await supabase.from('expense_entries').insert({
            business_id: businessId,
            description: exp.description,
            amount: exp.amount,
            category: exp.category,
            payment_method: 'transfer',
            quantity: 1,
            occurred_at: addDays(today, -2).toISOString(),
            notes: SEED_MARK,
        });
        if (error) log(`  ! error creando egreso "${exp.description}": ${error.message}`);
        else log(`  + egreso creado: "${exp.description}"`);
    }

    // ── Pipeline: verificación (no insertamos a mano — nace del trigger
    // pipeline_sync_from_appointment al crear/actualizar turnos, igual que en
    // producción cuando el bot o el dashboard agenda) ──────────────────────
    const { data: deals, error: dealsErr } = await supabase
        .from('pipeline_deals')
        .select('id, stage, patient_id')
        .eq('business_id', businessId);
    if (dealsErr) log(`  ! no se pudo leer pipeline_deals: ${dealsErr.message}`);
    else log(`  pipeline_deals para este negocio: ${deals.length} (esperado: >=1 tras los turnos de arriba)`);

    log('\nListo. Corré este script de nuevo cuando quieras — no duplica nada.');
    log(`SEED_BUSINESS_ID confirmado = ${businessId}`);
}

main().catch(err => {
    console.error('[seed] Error inesperado:', err);
    process.exit(1);
});
