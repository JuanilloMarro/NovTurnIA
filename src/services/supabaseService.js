import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';

// T-20: getBID() movido al store. Usar getBID() en cada función de servicio
// para leer el valor actual en el momento de la llamada (no en el momento de importar).
const getBID = () => useAppStore.getState().businessId;

// Caché de timezone del negocio — se carga una vez por sesión
// T-60: getBusinessTimezone reutiliza getBusinessInfo en lugar de hacer una query separada
let _businessTimezone = null;

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
    const [h, m] = time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
    const offset = getUTCOffset(timezone, targetDate);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00${offset}`;
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
        end:   appt.date_end.match(/T(\d{2}:\d{2})/)?.[1] || '',
    }));
}

export async function getAppointmentsByWeek(weekStart, weekEnd) {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(display_name, patient_phones(phone))')
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
        // Exclusion constraint violation = double booking
        if (error.code === '23P01') {
            throw new Error('Este horario ya está ocupado. Seleccioná otro.');
        }
        console.error('Insert Error — code:', error.code, '| message:', error.message, '| details:', error.details, '| hint:', error.hint);
        throw new Error('Error al guardar el turno. Verifica los datos.');
    }
    return data;
}

export async function updateAppointment(id, { date, startTime, endTime }) {
    const { data, error } = await supabase
        .from('appointments')
        .update({
            date_start: await toISO(date, startTime),
            date_end: await toISO(date, endTime),
        })
        .eq('id', id)
        .eq('business_id', getBID())
        .select()
        .single();

    if (error) {
        if (error.code === '23P01') {
            throw new Error('Este horario ya está ocupado. Seleccioná otro.');
        }
        throw error;
    }
    return data;
}

export async function cancelAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
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

export async function getPatientHistory(patientId) {
    const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('business_id', getBID())
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function reactivateBot(patientId) {
    const { data, error } = await supabase.rpc('reactivate_bot', {
        p_patient_id: patientId
    });
    if (error) throw error;
    return data;
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
            handoff_reason: 'manual',
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
        console.error('create_patient_with_phone RPC Error:', error);
        if (error.code === '23505') throw new Error('Ya existe un paciente con ese teléfono.');
        throw new Error('No se pudo registrar al paciente.');
    }

    // Devolver el paciente completo para mantener compatibilidad con el hook
    const { data: patient, error: fetchError } = await supabase
        .from('patients')
        .select('*, patient_phones(phone, is_primary)')
        .eq('id', patientId)
        .single();

    if (fetchError) throw new Error('Paciente creado pero error al recuperar datos.');
    return patient;
}

export async function updatePatient(patientId, { display_name, phone }) {
    const { error: patientError } = await supabase
        .from('patients')
        .update({ display_name })
        .eq('id', patientId)
        .eq('business_id', getBID());

    if (patientError) throw new Error('No se pudo actualizar el paciente.');

    if (phone) {
        const { data: existing, error: updateError } = await supabase
            .from('patient_phones')
            .update({ phone })
            .eq('patient_id', patientId)
            .eq('is_primary', true)
            .select();

        if (updateError) throw new Error('Paciente actualizado pero error al guardar teléfono.');

        if (!existing || existing.length === 0) {
            const { error: insertError } = await supabase
                .from('patient_phones')
                .insert({ patient_id: patientId, phone, is_primary: true });
            if (insertError) throw new Error('Paciente actualizado pero error al guardar teléfono.');
        }
    }
}

export async function deletePatient(patientId) {
    const { error } = await supabase
        .from('patients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', patientId)
        .eq('business_id', getBID());
    if (error) throw new Error('No se pudo eliminar al paciente.');
}

// ── Stats ─────────────────────────────────────────────────
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
export async function getBusinessInfo() {
    const { data, error } = await supabase
        .from('businesses')
        .select('id, name, plan, timezone, schedule_start, schedule_end, schedule_days')
        .eq('id', getBID())
        .single();

    if (error) throw error;
    return data;
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

export async function markNotificationsRead() {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('business_id', getBID())
        .eq('read', false);

    if (error) throw error;
}

export async function clearNotifications() {
    const actorId = useAppStore.getState().profile?.id ?? null;

    // T-56: registrar en audit_log quién borró todas las notificaciones
    await supabase.from('audit_log').insert({
        business_id: getBID(),
        action: 'DELETE',
        table_name: 'notifications',
        actor_id: actorId,
        new_data: { cleared_all: true },
    });

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('business_id', getBID());

    if (error) throw error;
}

// ── Staff Management ──────────────────────────────────────
export async function createStaffUser({ email, password, full_name, role_id }) {
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
 * Individual appointment rows for the trend chart (last N months).
 * MainChart needs date_start + status per row to group by week/month on the client.
 */
export async function getAppointmentTrend(monthsBack = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);
    since.setDate(1);

    const { data, error } = await supabase
        .from('appointments')
        .select('date_start, status')
        .eq('business_id', getBID())
        .gte('date_start', since.toISOString())
        .order('date_start', { ascending: true });

    if (error) throw error;
    return data || [];
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
        .select('id, display_name, human_takeover, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('display_name');

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
