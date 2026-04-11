import { supabase, BUSINESS_ID } from '../config/supabase';

// Caché de timezone del negocio — se carga una vez por sesión
let _businessTimezone = null;

async function getBusinessTimezone() {
    if (_businessTimezone) return _businessTimezone;
    const { data } = await supabase
        .from('businesses')
        .select('timezone')
        .eq('id', BUSINESS_ID)
        .single();
    _businessTimezone = data?.timezone || 'America/Guatemala';
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
export async function getAppointmentsByWeek(weekStart, weekEnd) {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(display_name, patient_phones(phone))')
        .eq('business_id', BUSINESS_ID)
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
            business_id: BUSINESS_ID,
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
        .eq('business_id', BUSINESS_ID)
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
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

export async function confirmAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ confirmed: true, status: 'confirmed' })
        .eq('id', id)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

export async function scheduledAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ confirmed: false, status: 'scheduled' })
        .eq('id', id)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

// ── Patients ──────────────────────────────────────────────
export async function getPatients(search = '') {
    let query = supabase
        .from('patients')
        .select(`
            *,
            patient_phones(phone, is_primary),
            appointments(id, date_start, status, confirmed)
        `)
        .eq('business_id', BUSINESS_ID)
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
        .order('date_start', { referencedTable: 'appointments', ascending: false })
        .limit(5, { referencedTable: 'appointments' });

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

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getPatientAppointments(patientId) {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, date_start, date_end, status, confirmed')
        .eq('patient_id', patientId)
        .eq('business_id', BUSINESS_ID)
        .order('date_start', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getAuditLog(limit = 100) {
    const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

export async function getPatientHistory(patientId) {
    const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('business_id', BUSINESS_ID)
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
    const { error } = await supabase
        .from('patients')
        .update({
            human_takeover: true,
            handoff_reason: 'manual',
            handoff_at: new Date().toISOString()
        })
        .eq('id', patientId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

export async function createPatient({ display_name, phone, email, notes }) {
    // 1. Crear paciente
    const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({ business_id: BUSINESS_ID, display_name })
        .select()
        .single();
    if (patientError) {
        console.error('Create Patient Error:', patientError);
        throw new Error('No se pudo registrar al paciente.');
    }

    // 2. Agregar teléfono
    const { error: phoneError } = await supabase
        .from('patient_phones')
        .insert({ patient_id: patient.id, phone, is_primary: true });
    if (phoneError) {
        console.error('Create Phone Error — code:', phoneError.code, '| msg:', phoneError.message, '| hint:', phoneError.hint);
        throw new Error('Paciente creado pero error al guardar teléfono.');
    }

    return patient;
}

export async function updatePatient(patientId, { display_name, phone }) {
    const { error: patientError } = await supabase
        .from('patients')
        .update({ display_name })
        .eq('id', patientId)
        .eq('business_id', BUSINESS_ID);

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
        .eq('business_id', BUSINESS_ID);
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
export async function getBusinessInfo() {
    const { data, error } = await supabase
        .from('businesses')
        .select('id, name, plan, schedule_start, schedule_end, schedule_days')
        .eq('id', BUSINESS_ID)
        .single();

    if (error) throw error;
    return data;
}

// ── Staff & Roles ─────────────────────────────────────────
export async function getStaffUsers() {
    const { data, error } = await supabase
        .from('staff_users')
        .select(`
            *,
            staff_roles (*)
        `)
        .eq('business_id', BUSINESS_ID)
        .eq('active', true)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function getStaffRoles() {
    const { data, error } = await supabase
        .from('staff_roles')
        .select('*')
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
    return data || [];
}

export async function updateRolePermissions(roleId, permissions) {
    const { error } = await supabase
        .from('staff_roles')
        .update({ permissions })
        .eq('id', roleId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

// ── Notifications (Persistent, Cloud-based) ──────────
export async function getNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) throw error;
    return data || [];
}

export async function markNotificationsRead() {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('business_id', BUSINESS_ID)
        .eq('read', false);

    if (error) throw error;
}

export async function clearNotifications() {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

// ── Staff Management ──────────────────────────────────────
export async function createStaffUser({ email, password, full_name, role_id }) {
    // 1. Crear usuario en auth.users (con anon key funciona si sign-ups está habilitado)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name,
                business_id: BUSINESS_ID,
                role_id: parseInt(role_id)
            }
        }
    });
    if (authError) throw authError;

    // 2. El trigger handle_new_staff_user crea automáticamente el row en staff_users
    // Retry con backoff exponencial para esperar al trigger
    let staffUser = null;
    for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        const { data } = await supabase
            .from('staff_users')
            .select('*, staff_roles(*)')
            .eq('id', authData.user.id)
            .single();
        if (data) { staffUser = data; break; }
    }
    if (!staffUser) throw new Error('Timeout esperando creación de staff user. Intenta recargar la página.');
    return staffUser;
}

export async function deleteStaffUser(userId) {
    // Desactivar en lugar de borrar (soft delete)
    const { error } = await supabase
        .from('staff_users')
        .update({ active: false })
        .eq('id', userId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

export async function updateStaffUserRole(userId, roleId) {
    const { error } = await supabase
        .from('staff_users')
        .update({ role_id: roleId })
        .eq('id', userId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}
