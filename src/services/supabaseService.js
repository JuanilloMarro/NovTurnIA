import { supabase, BUSINESS_ID } from '../config/supabase';

// Helper for dates
function toISO(date, time) {
    const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
    const [h, m] = time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00-06:00`;
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
            date_start: toISO(date, startTime),
            date_end: toISO(date, endTime),
            status: 'scheduled',
            created_by: 'dashboard',
            confirmed: false,
            notif_24hs: false
        })
        .select()
        .single();

    if (error) {
        // Exclusion constraint violation = double booking
        if (error.code === '23P01') {
            throw new Error('Este horario ya está ocupado. Seleccioná otro.');
        }
        console.error('Insert Error:', error);
        throw new Error('Error al guardar el turno. Verifica los datos.');
    }
    return data;
}

export async function updateAppointment(id, { date, startTime, endTime }) {
    const { data, error } = await supabase
        .from('appointments')
        .update({
            date_start: toISO(date, startTime),
            date_end: toISO(date, endTime),
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
        query = query.or(`display_name.ilike.%${search}%`);
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
        console.error('Create Phone Error:', phoneError);
        throw new Error('Paciente creado pero error al guardar teléfono.');
    }

    return patient;
}

export async function updatePatient(patientId, { display_name, phone }) {
    const promises = [
        supabase
            .from('patients')
            .update({ display_name })
            .eq('id', patientId)
            .eq('business_id', BUSINESS_ID)
    ];

    if (phone) {
        promises.push(
            supabase
                .from('patient_phones')
                .upsert({ patient_id: patientId, phone, is_primary: true }, { onConflict: 'patient_id,is_primary' })
        );
    }

    const results = await Promise.all(promises);

    const patientError = results[0]?.error;
    if (patientError) throw new Error('No se pudo actualizar el paciente.');

    if (phone) {
        // Try update first
        const { data: existing, error: updateError } = await supabase
            .from('patient_phones')
            .update({ phone })
            .eq('patient_id', patientId)
            .eq('is_primary', true)
            .select();

        // If no rows were updated, it means there's no primary phone yet, so we insert it
        if (!existing || existing.length === 0) {
            const { error: insertError } = await supabase
                .from('patient_phones')
                .insert({ patient_id: patientId, phone, is_primary: true });
            if (insertError) throw new Error('Paciente actualizado pero error al guardar teléfono.');
        } else if (updateError) {
            throw new Error('Paciente actualizado pero error al guardar teléfono.');
        }
    }
}

export async function deletePatient(patientId) {
    const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)
        .eq('business_id', BUSINESS_ID);
    if (error) throw new Error('No se pudo eliminar al paciente.');
}

// ── Stats ─────────────────────────────────────────────────
export async function getStatsOverview() {
    const [{ data: apptStats, error: e1 }, { data: patientStats, error: e2 }] = await Promise.all([
        supabase.from('mv_business_stats')
            .select('*')
            .eq('business_id', BUSINESS_ID)
            .order('month', { ascending: false })
            .limit(6),
        supabase.from('mv_patient_stats')
            .select('*')
            .eq('business_id', BUSINESS_ID)
            .single()
    ]);

    if (e1) throw e1;
    // e2 puede ser PGRST116 (no rows) si no hay datos aún
    return { apptStats: apptStats || [], patientStats: patientStats || null };
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
