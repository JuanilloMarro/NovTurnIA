import { supabase, supabaseAdmin, BUSINESS_ID, callEdgeFunction, setAuthToken, clearAuthToken, getAuthToken } from '../config/supabase';

// Helper for dates (from 04-appointments.md)
function timeToDecimal(str) {
    const [h, m] = str.slice(0, 5).split(':').map(Number);
    return h + m / 60;
}

function toISO(date, time) {
    const d = date instanceof Date ? date : new Date(date + 'T12:00:00');
    const [h, m] = time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;
}

// ── Appointments ──────────────────────────────────────────
export async function getAppointmentsByWeek(weekStart, weekEnd) {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, users(display_name)')
        .eq('business_id', BUSINESS_ID)
        .gte('date_start', weekStart)
        .lt('date_start', weekEnd)
        .order('date_start', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createAppointment({ userId, date, startTime, endTime }) {
    // ── Direct Insertion via Admin Client (Bypasses Edge Function Errors & RLS) ──
    const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
    
    // 1. Conflict Check (Manual)
    const { data: existing } = await supabaseAdmin
        .from('appointments')
        .select('id, date_start, date_end')
        .eq('business_id', BUSINESS_ID)
        .eq('status', 'active')
        .gte('date_start', `${dateStr}T00:00:00`)
        .lt('date_start', `${dateStr}T23:59:59`);

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    
    const conflict = (existing || []).find(a => {
        const getTime = iso => iso.includes('T') ? iso.split('T')[1] : iso.split(' ')[1];
        const sTime = getTime(a.date_start).slice(0, 5);
        const eTime = getTime(a.date_end).slice(0, 5);
        const aStart = timeToDecimal(sTime);
        const aEnd = timeToDecimal(eTime);
        return startDec < aEnd && endDec > aStart;
    });

    if (conflict) throw new Error('Este horario ya está ocupado.');

    // 2. Insert Record using Admin privileges
    const { data, error } = await supabaseAdmin
        .from('appointments')
        .insert({
            business_id: BUSINESS_ID,
            user_id: userId,
            date_start: toISO(date, startTime),
            date_end: toISO(date, endTime),
            status: 'active',
            confirmed: false,
            notif_24hs: false
        })
        .select()
        .single();

    if (error) {
        console.error('Admin Insert Error:', error);
        throw new Error('Error al guardar el turno. Verifica los datos.');
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
        .update({ confirmed: true })
        .eq('id', id)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

// ── Patients ──────────────────────────────────────────────
export async function getPatients(search = '') {
    let query = supabase
        .from('users')
        .select('*, appointments(id, date_start, status)')
        .eq('business_id', BUSINESS_ID)
        .order('display_name', { ascending: true });

    if (search) {
        query = query.or(`display_name.ilike.%${search}%,id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getPatientHistory(userId) {
    const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('business_id', BUSINESS_ID)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function setHumanTakeover(userId, value) {
    const { error } = await supabase
        .from('users')
        .update({ human_takeover: value })
        .eq('id', userId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}

export async function createPatient(patientData) {
    const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
            ...patientData,
            business_id: BUSINESS_ID,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Create Patient Error:', error);
        throw new Error('No se pudo registrar al paciente.');
    }
    return data;
}

// ── Stats ─────────────────────────────────────────────────
export async function getStatsOverview() {
    const startOfMonth = new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
    ).toISOString().slice(0, 10);

    const [{ count: totalPatients }, { count: totalApts }, { count: monthApts }] =
        await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID),
            supabase.from('appointments').select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID).eq('status', 'active'),
            supabase.from('appointments').select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID).eq('status', 'active')
                .gte('date_start', startOfMonth),
        ]);

    return { totalPatients, totalApts, monthApts };
}

// ── Staff & Roles (Auth via Edge Function) ───────────────
export async function loginStaff(email, password) {
    // ── Route through Edge Function (never send password to frontend) ──
    const result = await callEdgeFunction('auth-login', { email, password });
    return { user: result.user, token: result.token };
}

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

export async function createStaffUser(userData) {
    // ── Route through Edge Function (requires manage_users permission) ──
    const result = await callEdgeFunction('manage-staff', {
        action: 'create',
        ...userData,
    });
    return result.data;
}

export async function deleteStaffUser(id) {
    // ── Route through Edge Function (requires manage_users permission) ──
    await callEdgeFunction('manage-staff', {
        action: 'delete',
        id,
    });
}

export async function updateStaffUserRole(userId, roleId) {
    // ── Route through Edge Function (requires manage_users permission) ──
    await callEdgeFunction('manage-staff', {
        action: 'update-role',
        userId,
        roleId,
    });
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
