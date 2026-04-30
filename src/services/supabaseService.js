import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';

// T-20: getBID() movido al store. Usar getBID() en cada función de servicio
// para leer el valor actual en el momento de la llamada (no en el momento de importar).
const getBID = () => useAppStore.getState().businessId;

// Caché de timezone del negocio — se carga una vez por sesión
// T-60: getBusinessTimezone reutiliza getBusinessInfo en lugar de hacer una query separada
let _businessTimezone = null;

// Limpiar caches module-level al cerrar sesión — evita data stale al cambiar de cuenta
export function resetServiceCaches() {
    _businessTimezone = null;
}

async function getBusinessTimezone() {
    if (_businessTimezone) return _businessTimezone;
    const info = await getBusinessInfo();
    _businessTimezone = info?.timezone || 'America/Guatemala';
    return _businessTimezone;
}

// Obtiene el offset UTC de una IANA timezone en una fecha concreta (respeta DST)
function getUTCOffset(timezone, date) {
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-6';
    const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return '-06:00';
    const sign = match[1];
    const hours = match[2].padStart(2, '0');
    const minutes = (match[3] || '0').padStart(2, '0');
    return `${sign}${hours}:${minutes}`;
}

// Helper for dates — usa la timezone real del negocio
async function toISO(date, time) {
    const timezone = await getBusinessTimezone();
    const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
    if (!time) throw new Error('toISO: time is required');
    const [h, m] = time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
    const offset = getUTCOffset(timezone, targetDate);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00${offset}`;
}

// ── Services ─────────────────────────────────────────────

export async function getServices() {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', getBID())
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createService({ name, description, duration_minutes, price }) {
    const { data, error } = await supabase
        .from('services')
        .insert({
            business_id: getBID(),
            name: name.trim(),
            description: description?.trim() || null,
            duration_minutes: duration_minutes || 30,
            price: price ?? null,
            active: true,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateService(id, { name, description, duration_minutes, price }) {
    const { data, error } = await supabase
        .from('services')
        .update({
            name: name.trim(),
            description: description?.trim() || null,
            duration_minutes: duration_minutes || 30,
            price: price ?? null,
        })
        .eq('id', id)
        .eq('business_id', getBID())
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function toggleServiceActive(id, active) {
    const { error } = await supabase
        .from('services')
        .update({ active })
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function deleteService(id) {
    // Limpiar FK en turnos que referencian este servicio antes de eliminar
    await supabase
        .from('appointments')
        .update({ service_id: null })
        .eq('service_id', id)
        .eq('business_id', getBID());

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

// ── Appointments ──────────────────────────────────────────

/**
 * Returns occupied time ranges for a given date as { start: 'HH:MM', end: 'HH:MM' }[].
 * Used by NewAppointmentModal to grey-out already-booked slots before the user submits.
 */
export async function getOccupiedSlotsForDate(date) {
    const [dayStart, dayEnd] = await Promise.all([
        toISO(date, '00:00'),
        toISO(date, '23:59'),
    ]);

    const { data, error } = await supabase
        .from('appointments')
        .select('date_start, date_end')
        .eq('business_id', getBID())
        .gte('date_start', dayStart)
        .lte('date_start', dayEnd)
        .in('status', ['scheduled', 'confirmed']);

    if (error) throw error;

    // The stored ISO strings carry the local offset, so the T-portion IS the local time.
    return (data || []).map(appt => ({
        start: appt.date_start.match(/T(\d{2}:\d{2})/)?.[1] || '',
        end: appt.date_end.match(/T(\d{2}:\d{2})/)?.[1] || '',
    }));
}

export async function getAppointmentsByWeek(weekStart, weekEnd) {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(display_name, human_takeover, patient_phones(phone)), services(name, duration_minutes, price)')
        .eq('business_id', getBID())
        .gte('date_start', weekStart)
        .lt('date_start', weekEnd)
        .order('date_start', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createAppointment({ patientId, serviceId, date, startTime, endTime }) {
    const { data, error } = await supabase
        .from('appointments')
        .insert({
            business_id: getBID(),
            patient_id: patientId,
            service_id: serviceId || null,
            date_start: await toISO(date, startTime),
            date_end: await toISO(date, endTime),
            status: 'scheduled',
            created_by: 'dashboard',
            confirmed: false
        })
        .select()
        .single();

    if (error) {
        // Doble booking detectado por validate_appointment() (RAISE EXCEPTION → P0001)
        // o por una eventual exclusion_constraint (23P01). Cubrimos ambos casos.
        if (error.code === '23P01' || /turno activo en ese horario/i.test(error.message || '')) {
            throw new Error('Este horario ya está ocupado. Seleccioná otro.');
        }
        if (/horario del negocio/i.test(error.message || '')) {
            throw new Error('El turno está fuera del horario del negocio.');
        }
        console.error('Insert Error — code:', error.code, '| message:', error.message, '| details:', error.details, '| hint:', error.hint);
        throw error;
    }
    return data;
}

export async function updateAppointment(id, { date, startTime, endTime, serviceId }) {
    const updates = {
        date_start: await toISO(date, startTime),
        date_end: await toISO(date, endTime),
    };
    if (serviceId !== undefined) updates.service_id = serviceId;
    const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .eq('business_id', getBID())
        .select()
        .single();

    if (error) {
        if (error.code === '23P01' || /turno activo en ese horario/i.test(error.message || '')) {
            throw new Error('Este horario ya está ocupado. Seleccioná otro.');
        }
        if (/horario del negocio/i.test(error.message || '')) {
            throw new Error('El turno está fuera del horario del negocio.');
        }
        throw error;
    }
    return data;
}

export async function cancelAppointment(id, reason = null) {
    // T-49: registra cancelled_at separado de deleted_at para métricas de cancelación.
    const update = { status: 'cancelled', cancelled_at: new Date().toISOString() };
    if (reason) update.cancellation_reason = reason;

    const { error } = await supabase
        .from('appointments')
        .update(update)
        .eq('id', id)
        .eq('business_id', getBID());

    if (error) throw error;
}

export async function confirmAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ confirmed: true, status: 'confirmed' })
        .eq('id', id)
        .eq('business_id', getBID());

    if (error) throw error;
}

export async function scheduledAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ confirmed: false, status: 'scheduled' })
        .eq('id', id)
        .eq('business_id', getBID());

    if (error) throw error;
}

export async function markNoShow(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ status: 'no_show' })
        .eq('id', id)
        .eq('business_id', getBID());

    if (error) throw error;
}



/**
 * Returns appointments with status 'no_show' or 'cancelled' for the follow-up tab.
 * @param {Object} opts
 * @param {'all'|'no_show'|'cancelled'} opts.type   - filter by status type
 * @param {number}                      opts.days   - look-back window in days (default 30)
 */
export async function getLostAppointments({ type = 'all', days = 30 } = {}) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const statuses = type === 'no_show' ? ['no_show']
        : type === 'cancelled' ? ['cancelled']
            : ['no_show', 'cancelled'];

    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id, date_start, date_end, status, patient_id, service_id,
            patients(
                id, display_name, human_takeover, deleted_at,
                patient_phones(phone, is_primary)
            ),
            services(id, name, duration_minutes, price)
        `)
        .eq('business_id', getBID())
        .in('status', statuses)
        .gte('date_start', since.toISOString())
        .order('date_start', { ascending: false });

    if (error) throw error;
    return (data ?? []).filter(apt => apt.patients && apt.patients.deleted_at === null);
}

// ── Patients ──────────────────────────────────────────────
export async function getPatients(search = '', { page = 0, pageSize = 50 } = {}) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('patients')
        .select(`
            *,
            patient_phones(phone, is_primary),
            appointments(id, date_start, status, confirmed)
        `, { count: 'exact' })
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
        .order('date_start', { referencedTable: 'appointments', ascending: false })
        .limit(5, { referencedTable: 'appointments' })
        .range(from, to);

    if (search) {
        // Escapar caracteres especiales de PostgREST antes de interpolar en el filtro.
        // Los caracteres , ( ) . tienen significado en la sintaxis de filtros PostgREST:
        //   , separa condiciones OR
        //   ( ) agrupan expresiones
        //   . separa tabla.columna
        // Sin escape, un input como "Ana,id.gt.0" podría inyectar condiciones adicionales
        // (filter injection). Escapamos % y _ también para que la búsqueda sea literal.
        const safe = search.replace(/[%_(),. ]/g, c => `\\${c}`);
        query = query.or(`display_name.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0, hasMore: to < (count || 0) - 1 };
}

export async function getPatientAppointments(patientId) {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, date_start, date_end, status, confirmed')
        .eq('patient_id', patientId)
        .eq('business_id', getBID())
        .order('date_start', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getAuditLog({ page = 0, pageSize = 50 } = {}) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .eq('business_id', getBID())
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0, hasMore: to < (count || 0) - 1 };
}

// T-32: paginación con cursor — evita traer el historial completo de un paciente activo.
// Retorna { data: Message[], hasMore: boolean }.
// Para cargar mensajes anteriores: pasar before = oldest_message.created_at.
export async function getPatientHistory(patientId, { limit = 50, before = null } = {}) {
    let query = supabase
        .from('history')
        .select('*')
        .eq('business_id', getBID())
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    // Revertir para mostrar del más antiguo al más reciente en la UI
    return { data: rows.reverse(), hasMore: rows.length === limit };
}

export async function reactivateBot(patientId) {
    const { error } = await supabase
        .from('patients')
        .update({ human_takeover: false })
        .eq('id', patientId)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function setHumanTakeover(patientId, value) {
    if (!value) {
        // Reactivar bot via RPC (atómico)
        return reactivateBot(patientId);
    }
    // Activar takeover manual
    // T-52: handoff_at omitido — Postgres usa DEFAULT now() del servidor (timestamp confiable)
    const { error } = await supabase
        .from('patients')
        .update({
            human_takeover: true,
        })
        .eq('id', patientId)
        .eq('business_id', getBID());

    if (error) throw error;
}

export async function createPatient({ display_name, phone }) {
    // T-28: RPC atómica — patient + patient_phones en una sola transacción Postgres.
    // Si el INSERT de patient_phones falla, el INSERT de patients se revierte automáticamente.
    const { data: patientId, error } = await supabase.rpc('create_patient_with_phone', {
        p_business_id: getBID(),
        p_display_name: display_name,
        p_phone: phone,
    });

    if (error) {
        // T-23: código específico para duplicado de teléfono; resto relanza el error original
        if (error.code === '23505') throw new Error('Ya existe un cliente con ese teléfono.');
        throw error;
    }

    // Devolver el paciente completo para mantener compatibilidad con el hook
    const { data: patient, error: fetchError } = await supabase
        .from('patients')
        .select('*, patient_phones(phone, is_primary)')
        .eq('id', patientId)
        .single();

    if (fetchError) throw new Error('Cliente creado pero error al recuperar datos.');
    return patient;
}

export async function updatePatient(patientId, { display_name, phone, notes }) {
    const patch = { display_name };
    if (notes !== undefined) patch.notes = notes || null;

    const { error: patientError } = await supabase
        .from('patients')
        .update(patch)
        .eq('id', patientId)
        .eq('business_id', getBID());

    // T-23: relanzar error original para preservar código y mensaje de Supabase
    if (patientError) throw patientError;

    if (phone) {
        // T-55: business_id guard en patient_phones — defensa en profundidad.
        // Requiere que patient_phones tenga la columna business_id (ver migración T-19/T-55).
        const { data: existing, error: updateError } = await supabase
            .from('patient_phones')
            .update({ phone })
            .eq('patient_id', patientId)
            .eq('business_id', getBID())
            .eq('is_primary', true)
            .select();

        if (updateError) throw new Error('Cliente actualizado pero error al guardar teléfono.');

        if (!existing || existing.length === 0) {
            const { error: insertError } = await supabase
                .from('patient_phones')
                .insert({ patient_id: patientId, phone, is_primary: true, business_id: getBID() });
            if (insertError) throw new Error('Cliente actualizado pero error al guardar teléfono.');
        }
    }
}

export async function deletePatient(patientId) {
    const { error } = await supabase
        .from('patients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', patientId)
        .eq('business_id', getBID());
    // T-23: relanzar error original en lugar de ocultar el código de Supabase
    if (error) throw error;
}

/**
 * T-10: GDPR Art. 17 — Borrado permanente e irreversible de todos los datos del paciente.
 * Elimina en orden de dependencia: teléfonos → historial → citas → paciente.
 * Solo debe llamarse desde un flujo con confirmación explícita del administrador.
 */
export async function gdprDeletePatient(patientId) {
    const bid = getBID();

    const deletes = [
        supabase.from('patient_phones').delete().eq('patient_id', patientId).eq('business_id', bid),
        supabase.from('history').delete().eq('patient_id', patientId).eq('business_id', bid),
        supabase.from('appointments').delete().eq('patient_id', patientId).eq('business_id', bid),
    ];

    for (const op of deletes) {
        const { error } = await op;
        if (error) throw error;
    }

    const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)
        .eq('business_id', bid);

    if (error) throw error;
}

// ── Stats ─────────────────────────────────────────────────

/**
 * T-17: Single RPC replaces 3 parallel queries (getStatsOverview + getCurrentMonthAppointments
 * + getMessageCounts). Returns all dashboard data in one round-trip.
 */
export async function getStatsDashboard(monthStart, monthEnd) {
    const { data, error } = await supabase.rpc('get_stats_dashboard', {
        p_month_start: monthStart,
        p_month_end: monthEnd,
    });
    if (error) {
        // Fallback to 3-query path if RPC not deployed yet
        if (error.code === 'PGRST202' || error.code === '42883') {
            const [overview, apts, counts] = await Promise.all([
                getStatsOverview(),
                getCurrentMonthAppointments(monthStart, monthEnd),
                getMessageCounts(monthStart, monthEnd),
            ]);
            return {
                appt_stats: overview.apptStats || [],
                patient_stats: overview.patientStats,
                month_appointments: apts || [],
                sent_count: counts.sent,
                received_count: counts.received,
            };
        }
        throw error;
    }
    return data;
}

export async function getStatsOverview() {
    const [{ data: apptStats, error: e1 }, { data: patientStats, error: e2 }] = await Promise.all([
        supabase.rpc('get_business_stats'),
        supabase.rpc('get_patient_stats')
    ]);

    if (e1) throw e1;
    // PGRST116 = "no rows returned" — esperado cuando aún no hay datos
    if (e2 && e2.code !== 'PGRST116') throw e2;

    // get_patient_stats puede retornar un array (SETOF) o un record escalar
    // dependiendo de cómo esté declarada la función en Supabase.
    // Normalizamos ambos casos para no acoplarnos a la firma de retorno.
    const normalizedPatientStats = Array.isArray(patientStats)
        ? (patientStats[0] ?? null)
        : (patientStats ?? null);

    return { apptStats: apptStats || [], patientStats: normalizedPatientStats };
}

// ── Business Info ────────────────────────────────────────
// T-60: incluye timezone para que getBusinessTimezone() reutilice esta query
// T-08: join con plans para traer plan completo (tier, name, limits, features)
export async function getBusinessInfo() {
    const { data, error } = await supabase
        .from('businesses')
        .select('id, name, plan_status, plan_expires_at, timezone, schedule_start, schedule_end, schedule_days, appointment_duration, business_type, notification_email, custom_prompt, feature_flags, plans(id, tier, name, monthly_price, max_patients, max_staff, features)')
        .eq('id', getBID())
        .single();

    if (error) throw error;
    // Compatibilidad: exponer plan como string para código legacy que lea data.plan
    if (data) data.plan = data.plans?.tier || null;
    return data;
}

// ── Plans (catálogo) ─────────────────────────────────────
export async function getPlans() {
    const { data, error } = await supabase
        .from('plans')
        .select('id, tier, name, monthly_price, max_patients, max_staff, features, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function updateBusinessInfo(fields) {
    const { error, count } = await supabase
        .from('businesses')
        .update(fields, { count: 'exact' })
        .eq('id', getBID());

    if (error) throw error;
    if (count === 0) {
        throw new Error('No se pudo actualizar: El registro no existe o no tienes permisos de escritura (RLS) en la tabla de negocios.');
    }

    // Bust timezone cache so next toISO() picks up the new value
    _businessTimezone = null;
    return fields;
}

// T-38: Query mínima SOLO para schedule_start / schedule_end.
// Separada de getBusinessInfo() porque schedule_days puede no existir todavía en el schema,
// y una columna inexistente hace fallar TODA la query (error de PostgREST).
// Esta función nunca lanza — devuelve null si falla, para no romper el flujo de auth.
export async function getBusinessSchedule(businessId) {
    try {
        const id = businessId ?? getBID();
        if (!id) return null;
        const { data, error } = await supabase
            .from('businesses')
            .select('name, schedule_start, schedule_end, schedule_days, feature_flags')
            .eq('id', id)
            .single();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

// T-61: movido desde useAuth.js — todo acceso a DB pasa por el service layer
export async function getBusinessStatus(businessId) {
    const { data } = await supabase
        .from('businesses')
        .select('plan_status')
        .eq('id', businessId)
        .single();
    return data?.plan_status || 'active';
}

// ── Staff & Roles ─────────────────────────────────────────
export async function getStaffUsers() {
    const { data, error } = await supabase
        .from('staff_users')
        .select(`
            *,
            staff_roles (*)
        `)
        .eq('business_id', getBID())
        .eq('active', true)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function getStaffRoles() {
    const { data, error } = await supabase
        .from('staff_roles')
        .select('*')
        .eq('business_id', getBID());

    if (error) throw error;
    return data || [];
}

export async function updateRolePermissions(roleId, permissions) {
    const { error } = await supabase
        .from('staff_roles')
        .update({ permissions })
        .eq('id', roleId)
        .eq('business_id', getBID());

    if (error) throw error;
}

// ── Notifications (Persistent, Cloud-based) ──────────
export async function getNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('business_id', getBID())
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) throw error;
    return data || [];
}

export async function markOneNotificationRead(id) {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function deleteOneNotification(id) {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function markNotificationsRead() {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('business_id', getBID())
        .eq('read', false);

    if (error) throw error;
}

export async function clearNotifications() {
    const changedBy = useAppStore.getState().profile?.id ?? null;

    // T-56: registrar en audit_log quién borró todas las notificaciones
    // T-23: campo corregido actor_id → changed_by (nombre real en el schema)
    await supabase.from('audit_log').insert({
        business_id: getBID(),
        action: 'DELETE',
        table_name: 'notifications',
        record_id: 'bulk',
        changed_by: changedBy,
        new_data: { cleared_all: true },
    });

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('business_id', getBID());

    if (error) throw error;
}

// ── Pending Appointment Reminders (T-39) ─────────────────

/** Turnos con status='scheduled' en las próximas 24 horas */
export async function getPendingAppointmentsNext24h() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
        .from('appointments')
        .select('id, date_start, patients(display_name)')
        .eq('business_id', getBID())
        .eq('status', 'scheduled')
        .gte('date_start', now.toISOString())
        .lte('date_start', in24h.toISOString())
        .order('date_start', { ascending: true });

    if (error) throw error;
    return data || [];
}

/** Retorna el created_at de la última notificación de tipo pending_reminder */
export async function getLastPendingReminderTime() {
    const { data, error } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('business_id', getBID())
        .eq('type', 'pending_reminder')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data?.created_at ?? null;
}

/** Inserta una notificación de recordatorio con resumen de turnos pendientes */
export async function insertPendingReminderNotification(appointments) {
    const count = appointments.length;
    if (count === 0) return null;

    const tz = await getBusinessTimezone();
    const formatter = new Intl.DateTimeFormat('es', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const lines = appointments.map(appt => {
        const name = appt.patients?.display_name || 'Cliente';
        const timeStr = formatter.format(new Date(appt.date_start));
        return `${name} – ${timeStr}`;
    });

    // Evitar acumular o duplicar notificaciones en modo estricto/recargas: 
    // Borramos cualquier recordatorio anterior que siga sin leer antes de insertar el nuevo.
    await supabase
        .from('notifications')
        .delete()
        .eq('business_id', getBID())
        .eq('type', 'pending_reminder')
        .eq('read', false);

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            business_id: getBID(),
            type: 'pending_reminder',
            title: `${count} turno${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} de confirmar`,
            message: lines.join(' · '),
            read: false,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ── Staff Management ──────────────────────────────────────

// T-24: sliding-window rate limit — máx 3 creaciones por minuto por sesión de browser.
// Protege contra clics múltiples accidentales y scripts que llamen al Edge Function.
const _staffCreateLog = [];
const STAFF_RATE_LIMIT = 3;
const STAFF_RATE_WINDOW_MS = 60_000;

export async function createStaffUser({ email, password, full_name, role_id }) {
    const now = Date.now();
    const windowStart = now - STAFF_RATE_WINDOW_MS;
    // Descartar entradas fuera de la ventana
    while (_staffCreateLog.length && _staffCreateLog[0] < windowStart) _staffCreateLog.shift();
    if (_staffCreateLog.length >= STAFF_RATE_LIMIT) {
        throw new Error('Demasiados intentos. Esperá un minuto antes de crear más usuarios.');
    }
    _staffCreateLog.push(now);

    const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'create', email, password, full_name, role_id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.data;
}

export async function deleteStaffUser(userId) {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'delete', id: userId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
}

// ── Stats queries (T-29: moved from useStats.js) ──────────

/**
 * Appointments for the current month — detail breakdown (confirmed/bot/staff).
 * Not in mv_business_stats because MVs only store monthly aggregates, not individual rows.
 */
export async function getCurrentMonthAppointments(monthStart, monthEnd) {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, status, confirmed, created_by, date_start, created_at')
        .eq('business_id', getBID())
        .gte('date_start', monthStart)
        .lt('date_start', monthEnd);

    if (error) throw error;
    return data || [];
}

/**
 * Sent + received message counts for the current month.
 * T-50: filtered by month so the COUNT doesn't scan the full history table.
 */
export async function getMessageCounts(monthStart, monthEnd) {
    const [{ count: sent, error: e1 }, { count: received, error: e2 }] = await Promise.all([
        supabase
            .from('history')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', getBID())
            .eq('role', 'assistant')
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd),
        supabase
            .from('history')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', getBID())
            .eq('role', 'user')
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd),
    ]);

    if (e1) throw e1;
    if (e2) throw e2;
    return { sent: sent || 0, received: received || 0 };
}

/**
 * T-51: Aggregated appointment trend via RPC — replaces raw row fetch.
 * Falls back to a direct query + client-side aggregation when the RPC
 * hasn't been deployed yet (PGRST202 = function not found).
 * @param {string} granularity - 'day' | 'week' | 'month'
 * @param {string} start - ISO 8601 start date
 * @param {string} end   - ISO 8601 end date (exclusive)
 */
export async function getAppointmentTrend(granularity = 'month', start, end) {
    const { data, error } = await supabase.rpc('get_appointment_trend', {
        p_business_id: getBID(),
        p_granularity: granularity,
        p_start: start,
        p_end: end,
    });

    if (error) {
        // PGRST202 = RPC not deployed yet — aggregate client-side from raw rows
        if (error.code === 'PGRST202') {
            return _trendFallback(granularity, start, end);
        }
        throw error;
    }
    return data || [];
}

async function _trendFallback(granularity, start, end) {
    const { data, error } = await supabase
        .from('appointments')
        .select('date_start, status')
        .eq('business_id', getBID())
        .gte('date_start', start)
        .lt('date_start', end);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const map = {};
    data.forEach(row => {
        const d = new Date(row.date_start);
        let key;
        if (granularity === 'day') {
            key = d.toISOString().split('T')[0];
        } else if (granularity === 'week') {
            const dow = d.getDay();
            const mon = new Date(d);
            mon.setDate(d.getDate() - dow + (dow === 0 ? -6 : 1));
            mon.setHours(0, 0, 0, 0);
            key = mon.toISOString().split('T')[0];
        } else {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!map[key]) map[key] = { period: key, total: 0, completed: 0, cancelled: 0 };
        map[key].total++;
        if (row.status === 'completed') map[key].completed++;
        if (row.status === 'cancelled') map[key].cancelled++;
    });
    return Object.values(map);
}

// ── AuditLog helpers ──────────────────────────────────────

/**
 * Lightweight patient list for AuditLog context enrichment.
 * Only fetches id + display_name + primary phone — no appointments join.
 * T-30: Replaces the full getPatients() call that pulled 5 appointments per patient.
 */
export async function getPatientsForAuditLog() {
    const { data, error } = await supabase
        .from('patients')
        .select('id, display_name, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null);

    if (error) throw error;
    return data || [];
}

/**
 * T-31: Lightweight patient query for Conversations page.
 * Only fetches id, display_name, human_takeover, and primary phone — no appointments join.
 */
export async function getPatientsForConversations() {
    const { data, error } = await supabase
        .from('patients')
        .select('id, display_name, human_takeover, created_at, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ── Export ────────────────────────────────────────────────

/**
 * Fetches all active patients (no pagination) for CSV export.
 * Returns flat objects ready for downloadCSV().
 */
export async function exportAllPatients() {
    const { data, error } = await supabase
        .from('patients')
        .select('display_name, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('display_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(p => ({
        nombre: p.display_name || '',
        telefono: p.patient_phones?.find(ph => ph.is_primary)?.phone
            || p.patient_phones?.[0]?.phone
            || '',
    }));
}

export async function updateStaffUserRole(userId, roleId) {
    const { error } = await supabase
        .from('staff_users')
        .update({ role_id: roleId })
        .eq('id', userId)
        .eq('business_id', getBID());

    if (error) throw error;
}

// ── Plan limits (T-01) ────────────────────────────────────

/**
 * T-01: Retorna los límites del plan activo y el uso actual del negocio.
 * Llama la RPC get_plan_limits que cruza businesses + plans + conteos en vivo.
 * Si la RPC no existe (pre-migración), retorna null → el hook trata null como ilimitado.
 */
export async function getPlanLimits() {
    const { data, error } = await supabase.rpc('get_plan_limits', {
        p_business_id: getBID(),
    });
    // PGRST202 = function not found (migración aún no ejecutada) → ilimitado
    if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') return null;
        throw error;
    }
    return data;
}
