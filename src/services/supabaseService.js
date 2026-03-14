import { supabase, BUSINESS_ID, callEdgeFunction } from '../config/supabase';

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
    // ── Route through Edge Function (server-side validation) ──
    const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
    const result = await callEdgeFunction('create-appointment', {
        userId,
        date: dateStr,
        startTime,
        endTime,
    });
    return result.data;
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
