import { supabase } from '../config/supabase';
import { useAppStore } from '../store/useAppStore';
import { withRetry } from '../utils/withRetry';

// T-20: getBID() movido al store. Usar getBID() en cada función de servicio
// para leer el valor actual en el momento de la llamada (no en el momento de importar).
const getBID = () => useAppStore.getState().businessId;

// F-4: supabase-js NO lanza los errores — llegan en `res.error` — así que este
// helper relanza SOLO los transitorios (red caída / 5xx) para que withRetry
// reintente; los errores de negocio (RLS, 4xx, PGRST*) pasan sin reintento.
// Usar únicamente en LECTURAS (un retry de escritura puede duplicar datos).
async function retryRead(buildQuery, label) {
    return withRetry(async () => {
        const res = await buildQuery();
        if (res.error && ((res.status ?? 0) >= 500 || /failed to fetch|networkerror|load failed/i.test(res.error.message || ''))) {
            const err = new Error(res.error.message);
            err.status = res.status || 503;
            throw err;
        }
        return res;
    }, { label });
}

// Caché de timezone del negocio — se carga una vez por sesión
// T-60: getBusinessTimezone reutiliza getBusinessInfo en lugar de hacer una query separada
let _businessTimezone = null;

// M-010: cache de IDs visibles según el plan (TTL corto para reflejar altas/bajas)
let _visiblePatientIds = { ids: null, ts: 0 };
let _visibleStaffIds = { ids: null, ts: 0 };
const VISIBLE_TTL_MS = 30_000;

// Limpiar caches module-level al cerrar sesión — evita data stale al cambiar de cuenta
export function resetServiceCaches() {
    _businessTimezone = null;
    _visiblePatientIds = { ids: null, ts: 0 };
    _visibleStaffIds = { ids: null, ts: 0 };
}

// Invalida los caches de visibilidad — llamado tras crear/borrar pacientes o staff
export function invalidateVisibilityCache() {
    _visiblePatientIds = { ids: null, ts: 0 };
    _visibleStaffIds = { ids: null, ts: 0 };
    useAppStore.getState().invalidatePlanLimitsCache();
    // También invalida el cache del hook useVisiblePatients (import dinámico
    // para evitar dependencia circular service ↔ hook).
    import('../hooks/useVisiblePatients').then(m => m.invalidateVisiblePatients?.()).catch(() => {});
}

// M-010: devuelve los IDs de pacientes visibles para el plan actual.
// null = sin límite o RPC no disponible → no aplicar filtro en la query principal.
async function getVisiblePatientIds() {
    const now = Date.now();
    if (Array.isArray(_visiblePatientIds.ids) && now - _visiblePatientIds.ts < VISIBLE_TTL_MS) {
        return _visiblePatientIds.ids;
    }
    const { data, error } = await supabase.rpc('get_visible_patient_ids', { p_business_id: getBID() });
    if (error) return null; // degradación segura: RPC ausente o error → sin filtro
    const ids = Array.isArray(data) ? data : [];
    _visiblePatientIds = { ids, ts: now };
    return ids;
}

async function getVisibleStaffIds() {
    const now = Date.now();
    if (Array.isArray(_visibleStaffIds.ids) && now - _visibleStaffIds.ts < VISIBLE_TTL_MS) {
        return _visibleStaffIds.ids;
    }
    const { data, error } = await supabase.rpc('get_visible_staff_ids', { p_business_id: getBID() });
    if (error) return null;
    const ids = Array.isArray(data) ? data : [];
    _visibleStaffIds = { ids, ts: now };
    return ids;
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

// Sin argumentos: array completo (usado por selectores/pickers — Ofertas,
// Resumen de Finanzas, Vouchers). Con { page, pageSize }: página real vía
// `.range()` + count, para el listado de gestión (Settings) con "Cargar más".
export async function getServices({ page, pageSize } = {}) {
    let q = supabase
        .from('services')
        .select('*', pageSize != null ? { count: 'exact' } : undefined)
        .eq('business_id', getBID())
        .order('name', { ascending: true });
    if (pageSize != null) {
        const from = (page || 0) * pageSize;
        q = q.range(from, from + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count ?? 0 };
    }
    const { data, error } = await q;
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

// ── Categorías de Finanzas (dinámicas por negocio) ─────────
// kind: 'income' | 'expense'. category_id en income_entries/expense_entries
// referencia esta tabla (ON DELETE SET NULL — borrar una categoría no rompe asientos).

export async function getFinanceCategories() {
    const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .eq('business_id', getBID())
        .order('kind', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createFinanceCategory({ kind, name, color }) {
    const { data, error } = await supabase
        .from('finance_categories')
        .insert({
            business_id: getBID(),
            kind,
            name: name.trim(),
            color: color || null,
            active: true,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateFinanceCategory(id, { name, color }) {
    const { data, error } = await supabase
        .from('finance_categories')
        .update({
            name: name.trim(),
            color: color || null,
        })
        .eq('id', id)
        .eq('business_id', getBID())
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function toggleFinanceCategoryActive(id, active) {
    const { error } = await supabase
        .from('finance_categories')
        .update({ active })
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function deleteFinanceCategory(id) {
    // No hace falta limpiar FK a mano: category_id tiene ON DELETE SET NULL.
    const { error } = await supabase
        .from('finance_categories')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

// ── Offers (Enterprise — dynamic_pricing) ─────────────────
// Tabla offers se enlaza 1:1 con services. La vista services_with_active_offer
// expone effective_price para front + n8n. RLS scoped por business_id.

// Igual que getServices: sin args → array completo; con { page, pageSize } →
// página real (`.range()` + count) para el listado con "Cargar más".
export async function getOffers({ page, pageSize } = {}) {
    let q = supabase
        .from('offers')
        .select('*, services(id, name, price)', pageSize != null ? { count: 'exact' } : undefined)
        .eq('business_id', getBID())
        .order('starts_at', { ascending: false });
    if (pageSize != null) {
        const from = (page || 0) * pageSize;
        q = q.range(from, from + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count ?? 0 };
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

// Fallback para el deep-link ?offer=<id>: la oferta puede no estar entre lo
// ya cargado por la paginación real del listado.
export async function getOfferById(id) {
    const { data, error } = await supabase
        .from('offers')
        .select('*, services(id, name, price)')
        .eq('id', id)
        .eq('business_id', getBID())
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function createOffer({ service_id, name, description, promo_price, starts_at, ends_at, active = true }) {
    const { data, error } = await supabase
        .from('offers')
        .insert({
            business_id: getBID(),
            service_id,
            name: name.trim(),
            description: description?.trim() || null,
            promo_price,
            starts_at,
            ends_at,
            active,
        })
        .select('*, services(id, name, price)')
        .single();
    if (error) throw error;
    return data;
}

export async function updateOffer(id, { service_id, name, description, promo_price, starts_at, ends_at, active }) {
    const patch = {};
    if (service_id  !== undefined) patch.service_id  = service_id;
    if (name        !== undefined) patch.name        = name.trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (promo_price !== undefined) patch.promo_price = promo_price;
    if (starts_at   !== undefined) patch.starts_at   = starts_at;
    if (ends_at     !== undefined) patch.ends_at     = ends_at;
    if (active      !== undefined) patch.active      = active;
    const { data, error } = await supabase
        .from('offers')
        .update(patch)
        .eq('id', id)
        .eq('business_id', getBID())
        .select('*, services(id, name, price)')
        .single();
    if (error) throw error;
    return data;
}

export async function toggleOfferActive(id, active) {
    const { error } = await supabase
        .from('offers')
        .update({ active })
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function deleteOffer(id) {
    const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

// ── Appointments ──────────────────────────────────────────

/**
 * Returns occupied time ranges for a given date as { start: 'HH:MM', end: 'HH:MM' }[].
 * Used by NewAppointmentModal/EditAppointmentModal to filter already-booked slots.
 */
export async function getOccupiedSlotsForDate(date) {
    const [dayStart, dayEnd, timezone] = await Promise.all([
        toISO(date, '00:00'),
        toISO(date, '23:59'),
        getBusinessTimezone(),
    ]);

    const { data, error } = await supabase
        .from('appointments')
        .select('date_start, date_end')
        .eq('business_id', getBID())
        .gte('date_start', dayStart)
        .lte('date_start', dayEnd)
        .in('status', ['scheduled', 'confirmed']);

    if (error) throw error;

    // Supabase returns timestamptz normalized to UTC — convert to local business time.
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    return (data || []).map(appt => ({
        start: fmt.format(new Date(appt.date_start)),
        end: fmt.format(new Date(appt.date_end)),
    }));
}

export async function getAppointmentsByWeek(weekStart, weekEnd) {
    // F-4: lectura caliente del calendario — reintenta fallos transitorios de red
    const { data, error } = await retryRead(() => supabase
        .from('appointments')
        .select('*, patients(display_name, human_takeover, patient_phones(phone)), services(name, duration_minutes, price)')
        .eq('business_id', getBID())
        .gte('date_start', weekStart)
        .lt('date_start', weekEnd)
        .order('date_start', { ascending: true }), 'appointmentsByWeek');

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
        // Agenda avanzada: festivo/cerrado o cupo diario alcanzado (validate_appointment v2)
        if (error.hint === 'SCHEDULE_CLOSED') throw new Error('El negocio está cerrado ese día (festivo o excepción).');
        if (error.hint === 'SCHEDULE_DAILY_CAP') throw new Error('Se alcanzó el cupo máximo de citas para ese día.');
        // El trigger enforce_appointment_limit rechaza con HINT PLAN_LIMIT_* si el gate
        // de la UI no alcanzó a frenar (p. ej. dos pestañas abiertas).
        if (error.hint?.startsWith('PLAN_LIMIT')) {
            throw new Error('Alcanzaste el límite de turnos del mes de tu plan. Sube de plan para agendar más.');
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

export async function deleteAppointment(id) {
    const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());

    if (error) throw error;
}

export async function markAsRescheduled(id) {
    const { error } = await supabase
        .from('appointments')
        .update({ is_rescheduled: true })
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
// Paginación real (.range() + count) — la búsqueda por nombre/teléfono filtra
// sobre lo ya cargado en el cliente (mismo patrón que Finanzas/Servicios/Ofertas).
export async function getLostAppointments({ type = 'all', days = 30, page = 0, pageSize = 30 } = {}) {
    const since = new Date();
    if (days === 0) {
        // "Hoy": desde medianoche del día actual.
        since.setHours(0, 0, 0, 0);
    } else {
        since.setDate(since.getDate() - days);
        since.setHours(0, 0, 0, 0);
    }

    const statuses = type === 'no_show' ? ['no_show']
        : type === 'cancelled' ? ['cancelled']
            : ['no_show', 'cancelled'];

    const from = page * pageSize;
    const { data, error, count } = await supabase
        .from('appointments')
        .select(`
            id, date_start, date_end, status, patient_id, service_id, is_rescheduled,
            patients(
                id, display_name, human_takeover, deleted_at,
                patient_phones(phone, is_primary)
            ),
            services(id, name, duration_minutes, price)
        `, { count: 'exact' })
        .eq('business_id', getBID())
        .in('status', statuses)
        .eq('is_rescheduled', false)
        .gte('date_start', since.toISOString())
        .order('date_start', { ascending: false })
        .range(from, from + pageSize - 1);

    if (error) throw error;
    return {
        data: (data ?? []).filter(apt => apt.patients && apt.patients.deleted_at === null),
        count: count ?? 0,
    };
}

// ── Patients ──────────────────────────────────────────────
export async function getPatients(search = '', { page = 0, pageSize = 50 } = {}) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // M-010: aplicar visibilidad por plan — los pacientes fuera del top-N quedan
    // ocultos hasta que el negocio suba de plan (la data sigue intacta en DB).
    const visibleIds = await getVisiblePatientIds();

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

    if (Array.isArray(visibleIds)) {
        // Lista vacía requiere un sentinel para que PostgREST no devuelva todo
        query = query.in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000']);
    }

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

    // F-4: re-awaitear el mismo builder re-ejecuta el fetch (postgrest-js no cachea)
    const { data, error, count } = await retryRead(() => query, 'patients');
    if (error) throw error;
    return { data: data || [], count: count || 0, hasMore: to < (count || 0) - 1 };
}

// Búsqueda typeahead de pacientes (alta de turnos). RPC con ranking por relevancia
// (prefijo > inicio de palabra > subcadena > teléfono > similitud), insensible a
// tildes y tolerante a typos. Devuelve [{ id, display_name, phone }].
// Búsqueda global (Ctrl+K): pacientes + servicios + turnos próximos del negocio.
// RPC search_global — respeta la visibilidad por plan (reusa search_patients).
export async function searchGlobal(q, limit = 6) {
    const term = (q || '').trim();
    if (term.length < 2) return [];
    const { data, error } = await supabase.rpc('search_global', { p_q: term, p_limit: limit });
    if (error) throw error;
    return data || [];
}

export async function searchPatients(q, limit = 10) {
    const term = (q || '').trim();
    if (!term) return [];
    const { data, error } = await supabase.rpc('search_patients', { p_q: term, p_limit: limit });
    if (error) throw error;
    return data || [];
}

export async function getPatientById(patientId) {
    const { data, error } = await supabase
        .from('patients')
        .select(`*, patient_phones(phone, is_primary), appointments(id, date_start, status, confirmed)`)
        .eq('id', patientId)
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('date_start', { referencedTable: 'appointments', ascending: false })
        .limit(5, { referencedTable: 'appointments' })
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function getPatientAppointments(patientId) {
    const { data, error } = await supabase
        .from('appointments')
        .select('id, date_start, date_end, status, confirmed, services(name)')
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

/**
 * Clientes con la IA pausada (human_takeover = true) para el negocio actual.
 * Usado en Configuración IA para que el negocio vea y reanude la IA por cliente.
 * Ordena por created_at desc (más recientes primero). Escala a 100+ clientes.
 */
export async function getPausedPatients() {
    const { data, error } = await supabase
        .from('patients')
        .select('id, display_name, created_at, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .eq('human_takeover', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(p => ({
        id: p.id,
        display_name: p.display_name,
        phone: p.patient_phones?.find(ph => ph.is_primary)?.phone || p.patient_phones?.[0]?.phone || null,
    }));
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

/**
 * Envía un mensaje humano (agente) a un paciente vía la Edge Function
 * `wa-human-reply` de Supabase. La función valida el JWT, deriva el business_id
 * del staff (anti cross-tenant), envía por la Cloud API del tenant y es el único
 * escritor de `history` (acá NO insertamos para evitar duplicados).
 *
 * El JWT de Supabase se adjunta automáticamente por `functions.invoke`.
 *
 * @returns {Promise<{ ok: boolean, code?: string }>} code='WINDOW_EXPIRED' cuando
 *   la ventana de 24h de WhatsApp ya cerró (el cliente debe escribir primero).
 * @throws si el mensaje está vacío o la función responde un error no mapeado.
 */
export async function sendHumanMessage(patientId, text) {
    const body = (text || '').trim();
    if (!body) throw new Error('El mensaje está vacío.');

    const { error } = await supabase.functions.invoke('wa-human-reply', {
        body: { patient_id: patientId, text: body },
    });

    if (error) {
        // supabase-js expone la Response cruda en error.context para status 4xx/5xx
        let payload = null;
        if (error.context && typeof error.context.json === 'function') {
            try { payload = await error.context.json(); } catch { /* sin JSON */ }
        }
        const code = payload?.code || payload?.error || null;
        // 409 / code WINDOW_EXPIRED cuando pasó la ventana de 24h
        if (code === 'WINDOW_EXPIRED') {
            return { ok: false, code: 'WINDOW_EXPIRED' };
        }
        throw new Error(payload?.error || payload?.message || 'No se pudo enviar el mensaje.');
    }

    return { ok: true };
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
        // Trigger enforce_patient_limit (HINT PLAN_LIMIT_*): carrera contra el gate de la UI
        if (error.hint?.startsWith('PLAN_LIMIT')) throw new Error('Alcanzaste el límite de clientes de tu plan. Sube de plan para agregar más.');
        throw error;
    }

    // Devolver el paciente completo para mantener compatibilidad con el hook
    const { data: patient, error: fetchError } = await supabase
        .from('patients')
        .select('*, patient_phones(phone, is_primary)')
        .eq('id', patientId)
        .single();

    if (fetchError) throw new Error('Cliente creado pero error al recuperar datos.');
    invalidateVisibilityCache();
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
    invalidateVisibilityCache();
}

/**
 * Vacía el chat de un paciente: borra todos sus mensajes de `history` pero
 * conserva al paciente. Usado por el menú de Conversaciones ("Vaciar chat").
 */
export async function clearPatientHistory(patientId) {
    const { error } = await supabase
        .from('history')
        .delete()
        .eq('patient_id', patientId)
        .eq('business_id', getBID());
    if (error) throw error;
}

/**
 * Elimina UN mensaje individual del historial de conversación (como en el chat
 * de la IA). Requiere la política history_delete (business + is_business_active).
 */
export async function deleteHistoryMessage(id) {
    const { error } = await supabase
        .from('history')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

// ── Stats ─────────────────────────────────────────────────

/**
 * T-17: Single RPC replaces 3 parallel queries (getStatsOverview + getCurrentMonthAppointments
 * + getMessageCounts). Returns all dashboard data in one round-trip.
 */
export async function getStatsDashboard(monthStart, monthEnd) {
    const { data, error } = await supabase.rpc('get_stats_dashboard', {
        p_business_id: getBID(),
        p_month_start: monthStart,
        p_month_end:   monthEnd,
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
        .select('id, name, plan_status, plan_expires_at, timezone, schedule_start, schedule_end, schedule_days, appointment_duration, max_appointments_per_day, price_rounding_increment, business_type, notification_email, custom_prompt, feature_flags, plans(id, tier, name, monthly_price, annual_discount, max_patients, max_staff, max_conversations, max_appointments, features)')
        .eq('id', getBID())
        .single();

    if (error) throw error;
    // Compatibilidad: exponer plan como string para código legacy que lea data.plan
    if (data) data.plan = data.plans?.tier || null;
    return data;
}

// ── Agenda avanzada: excepciones (festivos/horario especial) + cupo diario ──
// La lógica dura vive en la DB (get_available_slots v2 + validate_appointment v2),
// aplicando a bot Y dashboard. Estas funciones solo administran la configuración.
export async function getScheduleExceptions() {
    const { data, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('business_id', getBID())
        .order('exception_date', { ascending: true });
    if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') return [];
        throw error;
    }
    return data || [];
}

export async function createScheduleException({ exception_date, is_closed = true, custom_start = null, custom_end = null, note = null }) {
    const { data, error } = await supabase
        .from('schedule_exceptions')
        .insert({ business_id: getBID(), exception_date, is_closed, custom_start, custom_end, note })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') throw new Error('Ya existe una excepción para esa fecha.');
        throw error;
    }
    return data;
}

export async function deleteScheduleException(id) {
    const { error } = await supabase
        .from('schedule_exceptions')
        .delete()
        .eq('id', id)
        .eq('business_id', getBID());
    if (error) throw error;
}

export async function updateDailyCap(maxPerDay) {
    // null / '' → sin tope
    const value = maxPerDay === '' || maxPerDay == null ? null : Number(maxPerDay);
    const { error } = await supabase
        .from('businesses')
        .update({ max_appointments_per_day: value })
        .eq('id', getBID());
    if (error) throw error;
    return value;
}

// Redondeo de precios (Ofertas: precio calculado por % de descuento).
export async function updatePriceRounding(increment) {
    const { error } = await supabase
        .from('businesses')
        .update({ price_rounding_increment: increment })
        .eq('id', getBID());
    if (error) throw error;
    return increment;
}

// ── Plans (catálogo) ─────────────────────────────────────
export async function getPlans() {
    const { data, error } = await supabase
        .from('plans')
        .select('id, tier, name, monthly_price, annual_discount, max_patients, max_staff, max_appointments, max_conversations, features, display_order')
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
    const visibleIds = await getVisibleStaffIds();
    let q = supabase
        .from('staff_users')
        .select(`
            *,
            staff_roles (*)
        `)
        .eq('business_id', getBID())
        .eq('active', true)
        .order('created_at', { ascending: true });
    if (Array.isArray(visibleIds)) {
        q = q.in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data, error } = await q;
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

export async function markOneNotificationUnread(id) {
    const { error } = await supabase
        .from('notifications')
        .update({ read: false })
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
        const dateStr = new Date(appt.date_start).toLocaleDateString('es', { day: '2-digit', month: 'short' });
        return `${name} · ${dateStr}`;
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
    invalidateVisibilityCache();
    return data.data;
}

export async function deleteStaffUser(userId) {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'delete', id: userId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    invalidateVisibilityCache();
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
        if (!map[key]) map[key] = { period: key, total: 0, no_show: 0, cancelled: 0 };
        if (row.status === 'scheduled' || row.status === 'confirmed') map[key].total++;
        if (row.status === 'no_show')   map[key].no_show++;
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
    const visibleIds = await getVisiblePatientIds();
    let q = supabase
        .from('patients')
        .select('id, display_name, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null);
    if (Array.isArray(visibleIds)) {
        q = q.in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

/**
 * T-31: Lightweight patient query for Conversations page.
 * Only fetches id, display_name, human_takeover, and primary phone — no appointments join.
 */
export async function getPatientsForConversations() {
    const visibleIds = await getVisiblePatientIds();
    let q = supabase
        .from('patients')
        .select('id, display_name, human_takeover, created_at, notes, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (Array.isArray(visibleIds)) {
        q = q.in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

// ── Export ────────────────────────────────────────────────

/**
 * Fetches all active patients (no pagination) for CSV export.
 * Returns flat objects ready for downloadCSV().
 */
export async function exportAllPatients() {
    const visibleIds = await getVisiblePatientIds();
    let q = supabase
        .from('patients')
        .select('display_name, patient_phones(phone, is_primary)')
        .eq('business_id', getBID())
        .is('deleted_at', null)
        .order('display_name', { ascending: true });
    if (Array.isArray(visibleIds)) {
        q = q.in('id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data, error } = await q;
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
    // F-4: corre en cada página (usePlanLimits) — reintenta fallos transitorios
    const { data, error } = await retryRead(() => supabase.rpc('get_plan_limits', {
        p_business_id: getBID(),
    }), 'planLimits');
    // PGRST202 = function not found (migración aún no ejecutada) → ilimitado
    if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') return null;
        throw error;
    }
    return data;
}

// ── Inteligencia (Enterprise) ─────────────────────────────

export async function getPatientLTV(startDate, endDate) {
    const { data, error } = await supabase.rpc('get_patient_ltv', {
        p_business_id: getBID(),
        p_end_date:    endDate,
    });
    if (error) throw error;
    return data || [];
}

export async function getRetentionRate(startDate, endDate) {
    const { data, error } = await supabase.rpc('get_retention_rate', {
        p_business_id: getBID(),
        p_end_date:    endDate,
    });
    if (error) throw error;
    return data?.[0] || { total_patients: 0, retained_patients: 0, retention_pct: 0, period_label: '' };
}

export async function getServiceAnalytics(startDate, endDate) {
    const { data, error } = await supabase.rpc('get_service_analytics', {
        p_business_id: getBID(),
        p_end_date:    endDate,
    });
    if (error) throw error;
    if (!data?.length) return [];

    // Defensa frontend: cruzar contra los servicios reales del negocio para
    // evitar que un RPC sin filtro correcto devuelva datos de otro negocio.
    const { data: ownServices } = await supabase
        .from('services')
        .select('name')
        .eq('business_id', getBID());
    const ownNames = new Set((ownServices || []).map(s => s.name).concat(['Sin servicio']));
    return data.filter(row => ownNames.has(row.service_name));
}

export async function getAppointmentPrediction(startDate, endDate) {
    const { data, error } = await supabase.rpc('get_appointment_prediction', {
        p_business_id: getBID(),
        p_end_date:    endDate,
    });
    if (error) throw error;
    return data || [];
}

// ════════════════════════════════════════════════════════════════════════════
// Centro IA — insights bajo demanda + chat de negocio (doc "Automatización
// Agente IA" · Parte B). Principio "pull, no push": la UI SIEMPRE lee de
// ai_insights/ai_chat_messages (cache → verlo cuesta 0 tokens); solo
// Generar/Regenerar y enviar un mensaje de chat invocan la Edge Function y
// gastan. El backend (tablas + Edge Functions ai-insights/ai-chat) puede no
// existir aún: la lectura degrada a [] y la generación lanza un error legible.
// business_id NUNCA viaja en el body: la Edge Function lo deriva del JWT.
// ════════════════════════════════════════════════════════════════════════════

// Códigos PostgREST cuando la tabla aún no está creada/expuesta.
const AI_TABLE_MISSING = new Set(['42P01', 'PGRST205', 'PGRST106', 'PGRST202']);

export async function getAIInsights({ scope = null, refId = null, limit = 20 } = {}) {
    let query = supabase
        .from('ai_insights')
        .select('id, scope, ref_id, content, generated_at')
        .eq('business_id', getBID())
        .order('generated_at', { ascending: false })
        .limit(limit);
    if (scope) query = query.eq('scope', scope);
    if (refId) query = query.eq('ref_id', refId);

    const { data, error } = await query;
    if (error) {
        if (AI_TABLE_MISSING.has(error.code)) return []; // backend pendiente → sin cache
        throw error;
    }
    return data || [];
}

export async function getLatestAIInsight(scope, refId = null) {
    const rows = await getAIInsights({ scope, refId, limit: 1 });
    return rows[0] || null;
}

// Nombres de pacientes por id (batch) — usado por Actividad reciente para
// mostrar a QUIÉN pertenece un análisis por cliente (ai_insights.ref_id no
// trae el nombre, solo el uuid).
export async function getPatientsByIds(ids) {
    if (!ids.length) return [];
    const { data, error } = await supabase
        .from('patients')
        .select('id, display_name')
        .eq('business_id', getBID())
        .in('id', ids);
    if (error) {
        if (AI_TABLE_MISSING.has(error.code)) return [];
        throw error;
    }
    return data || [];
}

// invoke() esconde el body de una respuesta no-2xx dentro de error.context
// (un Response). Sin esto, el usuario vería "no disponible" aunque la función
// haya explicado el motivo real (rate limit, plan, IA inválida...). Además
// adjunta el `code` del body (p. ej. 'ai_limit_reached') en err.code para que
// la UI pueda reaccionar (bloquear el input) sin parsear el texto.
async function functionError(error, fallback) {
    let message = fallback;
    let code = null;
    try {
        const body = await error?.context?.json();
        if (typeof body?.error === 'string' && body.error) message = body.error;
        if (typeof body?.code === 'string' && body.code) code = body.code;
    } catch { /* sin body JSON (p. ej. función caída o CORS) → fallback */ }
    const err = new Error(message);
    if (code) err.code = code;
    return err;
}

// Genera (o regenera) un insight — ÚNICA operación de este módulo que gasta
// tokens. La Edge Function escribe en ai_insights y devuelve la fila creada.
export async function generateAIInsight(scope, { refId = null, regenerate = true } = {}) {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { scope, ref_id: refId, regenerate },
    });
    if (error) {
        throw await functionError(error, 'El generador de análisis IA aún no está disponible. Inténtalo más tarde.');
    }
    return data;
}

// Chat de negocio (Enterprise): pregunta libre sobre los datos propios. El
// historial del hilo lo mantiene el backend (tabla ai_chat_messages, un hilo
// por staff_user_id) — el cliente solo manda el mensaje nuevo.
export async function getAIChatMessages(limit = 50) {
    const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('business_id', getBID())
        .order('created_at', { ascending: true })
        .limit(limit);
    if (error) {
        if (AI_TABLE_MISSING.has(error.code)) return [];
        throw error;
    }
    return data || [];
}

export async function askBusinessAI(message) {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message },
    });
    if (error) {
        throw await functionError(error, 'El chat de negocio IA aún no está disponible. Inténtalo más tarde.');
    }
    // Incluye los ids de los 2 mensajes insertados (usuario+asistente) para
    // poder borrarlos individualmente sin recargar el hilo.
    return {
        answer: data?.answer ?? '',
        userMessageId: data?.userMessageId ?? null,
        assistantMessageId: data?.assistantMessageId ?? null,
    };
}

// Consumo semanal REAL de tokens IA del negocio (chat + reportes) para la
// UsageBar del Centro IA. El tope de verdad lo aplica el backend (429
// ai_limit_reached en las Edge Functions); esto es solo lectura.
// Devuelve { used_tokens, limit_tokens, week_start, resets_at } o null.
export async function getAIUsage() {
    const { data, error } = await supabase.rpc('get_ai_usage');
    if (error) throw error;
    return data;
}

export async function deleteAIChatMessage(id) {
    const { error } = await supabase.from('ai_chat_messages').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteAllAIChatMessages() {
    const { error } = await supabase.from('ai_chat_messages').delete().eq('business_id', getBID());
    if (error) throw error;
}

// ── Helpers custom_prompt (nombre agente + instrucciones) ─

// Separa el custom_prompt en sus dos partes editables desde el UI.
// El formato guardado es: "Nombre del asistente: {name}\n\n{instructions}"
// n8n lee el campo completo — no requiere cambios en la automatización.
export function parseCustomPrompt(raw) {
    if (!raw) return { agentName: '', instructions: '' };
    const match = raw.match(/^Nombre del asistente:\s*(.+?)\n\n([\s\S]*)$/);
    if (match) return { agentName: match[1].trim(), instructions: match[2].trim() };
    return { agentName: '', instructions: raw.trim() };
}

// Combina nombre del agente e instrucciones en el string que se guarda en DB.
export function buildCustomPrompt(agentName, instructions) {
    const name = agentName?.trim() || '';
    const instr = instructions?.trim() || '';
    if (!name) return instr;
    if (!instr) return `Nombre del asistente: ${name}`;
    return `Nombre del asistente: ${name}\n\n${instr}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Finanzas — Insumos, Receta/BOM, Ingresos, Egresos y Resumen
// Todas las escrituras de ingresos/egresos quedan auditadas (trigger_audit_log).
// ════════════════════════════════════════════════════════════════════════════

// ── Insumos (catálogo) ───────────────────────────────────
export async function getSupplies({ activeOnly = false } = {}) {
    let q = supabase.from('supplies').select('*').eq('business_id', getBID()).order('name', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export async function createSupply({ name, unit, unit_cost, category, notes, stock = 0, min_stock = 0 }) {
    const { data, error } = await supabase
        .from('supplies')
        .insert({
            business_id: getBID(),
            name: name.trim(),
            unit: unit?.trim() || 'unidad',
            unit_cost: unit_cost ?? 0,
            category: category?.trim() || null,
            notes: notes?.trim() || null,
            stock: stock ?? 0,
            min_stock: min_stock ?? 0,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateSupply(id, fields) {
    const patch = {};
    ['name', 'unit', 'category', 'notes'].forEach(k => {
        if (fields[k] !== undefined) patch[k] = (typeof fields[k] === 'string' ? fields[k].trim() || null : fields[k]);
    });
    if (fields.unit_cost !== undefined) patch.unit_cost = fields.unit_cost;
    if (fields.active !== undefined) patch.active = fields.active;
    if (fields.stock !== undefined) patch.stock = fields.stock;
    if (fields.min_stock !== undefined) patch.min_stock = fields.min_stock;
    const { data, error } = await supabase
        .from('supplies').update(patch).eq('id', id).eq('business_id', getBID()).select().single();
    if (error) throw error;
    return data;
}

export async function toggleSupplyActive(id, active) {
    const { error } = await supabase.from('supplies').update({ active }).eq('id', id).eq('business_id', getBID());
    if (error) throw error;
}

export async function deleteSupply(id) {
    const { error } = await supabase.from('supplies').delete().eq('id', id).eq('business_id', getBID());
    if (error) throw error;
}

// ── Receta / BOM por servicio ────────────────────────────
export async function getServiceRecipe(serviceId) {
    const { data, error } = await supabase
        .from('service_supplies')
        .select('*, supplies(id, name, unit, unit_cost, active)')
        .eq('service_id', serviceId)
        .eq('business_id', getBID());
    if (error) throw error;
    return data || [];
}

// Reemplaza la receta completa del servicio con la lista provista (delete + insert).
export async function setServiceRecipe(serviceId, items) {
    const bid = getBID();
    const del = await supabase.from('service_supplies').delete().eq('service_id', serviceId).eq('business_id', bid);
    if (del.error) throw del.error;
    const rows = (items || [])
        .filter(it => it.supply_id && Number(it.quantity) > 0)
        .map(it => ({ business_id: bid, service_id: serviceId, supply_id: it.supply_id, quantity: it.quantity }));
    if (rows.length === 0) return [];
    const { data, error } = await supabase
        .from('service_supplies').insert(rows).select('*, supplies(id, name, unit, unit_cost)');
    if (error) throw error;
    return data || [];
}

// Costo teórico por servicio (vista v_service_cost = Σ receta)
export async function getServiceCosts() {
    const { data, error } = await supabase
        .from('v_service_cost').select('service_id, total_cost').eq('business_id', getBID());
    if (error) throw error;
    return data || [];
}

// ── Ingresos ─────────────────────────────────────────────
// Paginación real (page/pageSize, .range()+count exact — mismo patrón que
// getPatients/getAuditLog) para que el libro de ingresos no dependa de cargar
// todo el período de un solo golpe. `page`/`pageSize` opcionales: si no se
// pasan, se comporta como antes (primera página de `pageSize` filas).
export async function getIncomeEntries({ start, end, status = 'confirmed', page = 0, pageSize = 200 } = {}) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
        .from('income_entries')
        .select('*, patients(display_name), finance_categories(id, name, color)', { count: 'exact' })
        .eq('business_id', getBID())
        .order('occurred_at', { ascending: false })
        .range(from, to);
    if (status) q = q.eq('status', status);
    if (start) q = q.gte('occurred_at', start);
    if (end) q = q.lt('occurred_at', end);
    const { data, error, count } = await q;
    if (error) throw error;
    return { data: data || [], count: count ?? 0 };
}

// Ingreso manual / ad-hoc (venta sin turno, producto, etc.)
export async function recordIncome({ description, amount, payment_method, occurred_at, quantity = 1, service_id = null, patient_id = null, category_id = null, notes = null, source = 'manual', staff_id = null }) {
    const { data, error } = await supabase
        .from('income_entries')
        .insert({
            business_id: getBID(),
            source,
            description: description.trim(),
            amount,
            quantity,
            payment_method: payment_method || null,
            service_id,
            patient_id,
            category_id,
            staff_id,
            occurred_at: occurred_at || new Date().toISOString(),
            notes: notes?.trim() || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Editar un ingreso (descripción, monto, método, fecha, categoría, notas)
export async function updateIncome(id, fields) {
    const patch = {};
    if (fields.description !== undefined) patch.description = fields.description.trim();
    if (fields.amount !== undefined) patch.amount = fields.amount;
    if (fields.payment_method !== undefined) patch.payment_method = fields.payment_method || null;
    if (fields.occurred_at !== undefined) patch.occurred_at = fields.occurred_at;
    if (fields.category_id !== undefined) patch.category_id = fields.category_id || null;
    if (fields.notes !== undefined) patch.notes = fields.notes?.trim() || null;
    const { data, error } = await supabase
        .from('income_entries').update(patch).eq('id', id).eq('business_id', getBID()).select('*, patients(display_name), finance_categories(id, name, color)').single();
    if (error) throw error;
    return data;
}

// Paso 1 — enviar el cobro de un turno a validación (crea ingreso 'pending',
// aún NO cuenta como ingreso). Aparece en la lista "Por confirmar".
// staffId (opcional) atribuye el servicio a un profesional para comisiones —
// el % vigente se congela en la entrada (snapshot vía trigger en DB).
export async function submitIncomeValidation({ appointmentId, amount, paymentMethod = null, notes = null, staffId = null }) {
    const { data, error } = await supabase.rpc('submit_income_validation', {
        p_appointment_id: appointmentId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_notes: notes,
        p_staff_id: staffId,
    });
    if (error) throw error;
    return data;
}

// Paso 2 — confirmar la validación (pending -> confirmed). El dinero entró, ya cuenta.
export async function confirmIncomeValidation(id) {
    const { data, error } = await supabase.rpc('confirm_income_validation', { p_id: id });
    if (error) throw error;
    return data;
}

export async function voidIncome(id, reason = null) {
    const { data, error } = await supabase.rpc('void_income_entry', { p_id: id, p_reason: reason });
    if (error) throw error;
    return data;
}

// Ingreso de un turno (pending o confirmed). Devuelve { status } para que el
// detalle del turno muestre "En validación" vs "Cobrado". null si no hay cobro.
export async function getAppointmentIncome(appointmentId) {
    const { data, error } = await supabase
        .from('income_entries')
        .select('id, amount, payment_method, occurred_at, status')
        .eq('appointment_id', appointmentId)
        .eq('business_id', getBID())
        .eq('source', 'appointment')
        .in('status', ['pending', 'confirmed'])
        .maybeSingle();
    if (error) throw error;
    return data;
}

// Cola de validación de ingresos (lista "Por confirmar") — ingresos 'pending'
// con su detalle: cliente, turno, servicio, costo y monto cobrado.
export async function getPendingValidations() {
    const { data, error } = await supabase.rpc('get_pending_validations');
    if (error) throw error;
    return data || [];
}

// ── Egresos / Gastos ─────────────────────────────────────
// Misma paginación real que getIncomeEntries — .range()+count exact.
export async function getExpenseEntries({ start, end, status = 'confirmed', page = 0, pageSize = 200 } = {}) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
        .from('expense_entries')
        .select('*, supplies(name, unit), finance_categories(id, name, color)', { count: 'exact' })
        .eq('business_id', getBID())
        .order('occurred_at', { ascending: false })
        .range(from, to);
    if (status) q = q.eq('status', status);
    if (start) q = q.gte('occurred_at', start);
    if (end) q = q.lt('occurred_at', end);
    const { data, error, count } = await q;
    if (error) throw error;
    return { data: data || [], count: count ?? 0 };
}

// category (texto) se conserva por compatibilidad con get_finance_summary/ExpenseSection
// legacy; category_id es la fuente dinámica nueva — ambos se escriben juntos.
export async function recordExpense({ description, amount, category = 'general', category_id = null, payment_method = null, occurred_at, quantity = 1, supply_id = null, recurring = false, frequency = 'one_time', notes = null }) {
    const { data, error } = await supabase
        .from('expense_entries')
        .insert({
            business_id: getBID(),
            description: description.trim(),
            amount,
            category: category || 'general',
            category_id,
            payment_method: payment_method || null,
            quantity,
            supply_id,
            recurring,
            frequency,
            occurred_at: occurred_at || new Date().toISOString(),
            notes: notes?.trim() || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Editar un egreso (descripción, monto, categoría, fecha, recurrencia, notas)
export async function updateExpense(id, fields) {
    const patch = {};
    if (fields.description !== undefined) patch.description = fields.description.trim();
    if (fields.amount !== undefined) patch.amount = fields.amount;
    if (fields.category !== undefined) patch.category = fields.category || 'general';
    if (fields.category_id !== undefined) patch.category_id = fields.category_id || null;
    if (fields.occurred_at !== undefined) patch.occurred_at = fields.occurred_at;
    if (fields.recurring !== undefined) patch.recurring = fields.recurring;
    if (fields.frequency !== undefined) patch.frequency = fields.frequency;
    if (fields.notes !== undefined) patch.notes = fields.notes?.trim() || null;
    const { data, error } = await supabase
        .from('expense_entries').update(patch).eq('id', id).eq('business_id', getBID()).select('*, supplies(name, unit), finance_categories(id, name, color)').single();
    if (error) throw error;
    return data;
}

export async function voidExpense(id, reason = null) {
    const { data, error } = await supabase.rpc('void_expense_entry', { p_id: id, p_reason: reason });
    if (error) throw error;
    return data;
}

// ── Resumen financiero (KPIs + serie + desgloses, 1 round-trip) ──
export async function getFinanceSummary(start, end, granularity = 'day') {
    // F-4: lectura caliente de Finanzas — reintenta fallos transitorios
    const { data, error } = await retryRead(() => supabase.rpc('get_finance_summary', {
        p_start: start,
        p_end: end,
        p_granularity: granularity,
    }), 'financeSummary');
    if (error) throw error;
    return data;
}

// Serie temporal ingresos vs egresos (claves period calzan con buildSlots del front)
export async function getFinanceTrend(granularity = 'month', start, end) {
    const { data, error } = await supabase.rpc('get_finance_trend', {
        p_start: start,
        p_end: end,
        p_granularity: granularity,
    });
    if (error) throw error;
    return data || [];
}

// ════════════════════════════════════════════════════════════════════════════
// Finanzas v2 — meta mensual, métodos de pago, por cobrar (abonos), producción
// por profesional, caja diaria y proyección de cierre.
// (doc "Finanzas v2 - Evaluacion y Roadmap")
// ════════════════════════════════════════════════════════════════════════════

// ── Ajustes: meta mensual (real por mes, finance_monthly_goals) ──────────
export async function getMonthlyGoals(year) {
    const { data, error } = await supabase
        .from('finance_monthly_goals')
        .select('*')
        .eq('business_id', getBID())
        .eq('year', year);
    if (error) throw error;
    return data || [];
}

export async function saveMonthlyGoal(year, month, amount) {
    const { data, error } = await supabase
        .from('finance_monthly_goals')
        .upsert({ business_id: getBID(), year, month, goal_amount: amount ?? 0 }, { onConflict: 'business_id,year,month' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Métodos de pago configurables ────────────────────────
// `code` es el identificador que se guarda en income/expense.payment_method:
// se genera del label al crear y NUNCA cambia (estabilidad del histórico).
export async function getPaymentMethods({ activeOnly = false } = {}) {
    let q = supabase.from('payment_methods').select('*').eq('business_id', getBID())
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

function slugifyMethodCode(label) {
    return (label || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'metodo';
}

export async function createPaymentMethod({ label, fee_pct = 0, is_cash = false }) {
    const { data, error } = await supabase
        .from('payment_methods')
        .insert({
            business_id: getBID(),
            code: slugifyMethodCode(label),
            label: label.trim(),
            fee_pct: fee_pct ?? 0,
            is_cash,
            sort_order: 99,
        })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') throw new Error('Ya existe un método con ese nombre.');
        throw error;
    }
    return data;
}

export async function updatePaymentMethod(id, fields) {
    const patch = {};
    if (fields.label !== undefined) patch.label = fields.label.trim();
    if (fields.fee_pct !== undefined) patch.fee_pct = fields.fee_pct ?? 0;
    if (fields.is_cash !== undefined) patch.is_cash = fields.is_cash;
    if (fields.active !== undefined) patch.active = fields.active;
    const { data, error } = await supabase
        .from('payment_methods').update(patch).eq('id', id).eq('business_id', getBID()).select().single();
    if (error) throw error;
    return data;
}

export async function deletePaymentMethod(id) {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id).eq('business_id', getBID());
    if (error) throw error;
}

// ── Por cobrar: planes de pago + abonos ──────────────────
// Paginación real (p_limit/p_offset en la RPC) — hasMore se infiere por
// "vinieron tantas filas como pedí" (mismo criterio que getPatientHistory),
// la RPC no trae un count total.
export async function getPaymentPlans(status = null, { page = 0, pageSize = 20 } = {}) {
    const { data, error } = await supabase.rpc('get_payment_plans', { p_status: status, p_limit: pageSize, p_offset: page * pageSize });
    if (error) throw error;
    return data || [];
}

export async function createPaymentPlan({ patient_id = null, description, total_amount, notes = null }) {
    const { data, error } = await supabase
        .from('payment_plans')
        .insert({
            business_id: getBID(),
            patient_id,
            description: description.trim(),
            total_amount,
            notes: notes?.trim() || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// Abono atómico (RPC): inserta el ingreso confirmado y completa el plan si el
// saldo llega a 0. Devuelve { entry, paid, balance, completed }.
export async function recordPlanPayment({ planId, amount, paymentMethod = null, notes = null }) {
    const { data, error } = await supabase.rpc('record_plan_payment', {
        p_plan_id: planId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_notes: notes,
    });
    if (error) throw error;
    return data;
}

export async function cancelPaymentPlan(id, reason = null) {
    const { data, error } = await supabase.rpc('cancel_payment_plan', { p_id: id, p_reason: reason });
    if (error) throw error;
    return data;
}

// ── Vouchers de pago (código único compartible) ──────────
// Los vouchers ligados a un cobro de turno (income_id != null) los crea la DB
// en submit_income_validation; aquí solo se listan/crean los manuales.
export async function getVouchers(status = 'pending') {
    let q = supabase
        .from('payment_vouchers')
        .select('*, patients(display_name), payment_plans(description), redeemed_income:income_entries!payment_vouchers_redeemed_income_id_fkey(payment_method, occurred_at)')
        .eq('business_id', getBID())
        .order('created_at', { ascending: false })
        .limit(100);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') return [];
        throw error;
    }
    return data || [];
}

export async function createVoucher({ amount, patient_id = null, plan_id = null, note = null, expires_at = null, service_name = null }) {
    const { data, error } = await supabase.rpc('create_voucher', {
        p_amount: amount, p_patient_id: patient_id, p_plan_id: plan_id, p_note: note, p_expires_at: expires_at, p_service_name: service_name,
    });
    if (error) throw error;
    return data; // fila del voucher (incl. code)
}

// Redime por código: crea el ingreso (abono si liga a plan; 'voucher' si no).
export async function redeemVoucher(code, paymentMethod = null) {
    const { data, error } = await supabase.rpc('redeem_voucher', { p_code: code, p_payment_method: paymentMethod });
    if (error) throw error;
    return data; // { income, plan_completed }
}

export async function cancelVoucher(id) {
    const { error } = await supabase.rpc('cancel_voucher', { p_id: id });
    if (error) throw error;
}

// ── Producción y comisiones por profesional ──────────────
export async function getStaffProduction(start, end) {
    const { data, error } = await supabase.rpc('get_staff_production', { p_start: start, p_end: end });
    if (error) throw error;
    return data || [];
}

export async function setStaffCommission(staffId, pct) {
    const { data, error } = await supabase.rpc('set_staff_commission', { p_staff_id: staffId, p_pct: pct });
    if (error) throw error;
    return data;
}

// ── Caja diaria ──────────────────────────────────────────
// Estado vivo de la caja abierta: { session, cash_in, cash_out, expected } o null.
export async function getCashStatus(sessionId = null) {
    const { data, error } = await supabase.rpc('get_cash_session_status', { p_id: sessionId });
    if (error) throw error;
    return data;
}

export async function openCashSession(openingAmount, notes = null) {
    const { data, error } = await supabase.rpc('open_cash_session', {
        p_opening_amount: openingAmount, p_notes: notes,
    });
    if (error) throw error;
    return data;
}

export async function closeCashSession(countedAmount, notes = null) {
    const { data, error } = await supabase.rpc('close_cash_session', {
        p_counted_amount: countedAmount, p_notes: notes,
    });
    if (error) throw error;
    return data;
}

export async function getCashSessions({ page = 0, pageSize = 20 } = {}) {
    const { data, error } = await supabase.rpc('get_cash_sessions', { p_limit: pageSize, p_offset: page * pageSize });
    if (error) throw error;
    return data || [];
}

// ── Proyección de cierre del mes (agenda × asistencia histórica) ──
export async function getFinanceProjection() {
    const { data, error } = await supabase.rpc('get_finance_projection');
    if (error) throw error;
    return data;
}
