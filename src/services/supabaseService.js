import { supabase, BUSINESS_ID } from '../config/supabase';

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
    // Verificar disponibilidad primero
    const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
    const { data: existing } = await supabase
        .from('appointments')
        .select('id, date_start, date_end')
        .eq('business_id', BUSINESS_ID)
        .eq('status', 'active')
        .gte('date_start', `${dateStr}T00:00:00`)
        .lt('date_start', `${dateStr}T23:59:59`);

    const startDec = timeToDecimal(startTime);
    const endDec = timeToDecimal(endTime);
    const conflict = (existing || []).find(a => {
        const aStart = timeToDecimal(a.date_start.slice(11, 16));
        const aEnd = timeToDecimal(a.date_end.slice(11, 16));
        return startDec < aEnd && endDec > aStart;
    });

    if (conflict) throw new Error('Ya existe un turno en ese horario');

    const { data, error } = await supabase
        .from('appointments')
        .insert({
            business_id: BUSINESS_ID,
            user_id: userId,
            date_start: toISO(date, startTime),
            date_end: toISO(date, endTime),
            status: 'active',
            confirmed: false,
            notif_24hs: false,
        })
        .select()
        .single();

    if (error) throw error;
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

// ── Staff & Roles (Manual Auth) ───────────────────────────
export async function loginStaff(email, password) {
    const { data, error } = await supabase
        .from('staff_users')
        .select(`
            *,
            staff_roles (*)
        `)
        .eq('email', email)
        .eq('password', password)
        .eq('active', true)
        .single();

    if (error || !data) throw new Error('Credenciales incorrectas o usuario inactivo');
    return data;
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
    const { data, error } = await supabase
        .from('staff_users')
        .insert({
            ...userData,
            business_id: BUSINESS_ID
        })
        .select(`
            *,
            staff_roles (*)
        `)
        .single();

    if (error) throw error;
    return data;
}

export async function deleteStaffUser(id) {
    console.log('supabaseService.deleteStaffUser for id:', id, 'business_id:', BUSINESS_ID);
    
    // Try delete first
    const { error, count } = await supabase
        .from('staff_users')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('business_id', BUSINESS_ID);

    if (error) {
        console.error('Supabase delete error details:', error);
        throw error;
    }

    console.log('Delete result - rows affected:', count);

    // If RLS silently blocked the delete (0 rows affected), try deactivating instead
    if (count === 0) {
        console.log('Delete blocked by RLS, trying to deactivate user...');
        const { error: updateError } = await supabase
            .from('staff_users')
            .update({ active: false })
            .eq('id', id)
            .eq('business_id', BUSINESS_ID);

        if (updateError) {
            console.error('Deactivate error:', updateError);
            throw new Error('No se pudo eliminar ni desactivar al usuario. Verifica los permisos de la base de datos.');
        }
        console.log('User deactivated successfully as fallback.');
    } else {
        console.log('Result of Supabase delete: Success.');
    }
}

export async function updateStaffUserRole(userId, roleId) {
    const { error } = await supabase
        .from('staff_users')
        .update({ role_id: roleId })
        .eq('id', userId)
        .eq('business_id', BUSINESS_ID);

    if (error) throw error;
}
