import { supabase } from '../config/supabase';

// ── Invocación robusta de Edge Functions de admin ───────────────────────────
// supabase.functions.invoke() llama internamente a getSession(), que espera el
// navigator lock de gotrue. Si el lock queda huérfano (pestañas zombis, doble
// mount de StrictMode), invoke() se cuelga PARA SIEMPRE sin enviar la request
// (bug observado 2026-07-05: el alta de tenant "se quedaba trabada" y en los
// logs del servidor nunca aparecía el POST). Estas utilidades hacen fetch
// directo con timeout duro y obtienen el token sin poder bloquearse.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function getAccessToken() {
    // 1) Vía oficial con guarda de 3s (si el lock está atascado, no esperamos más)
    try {
        const session = await Promise.race([
            supabase.auth.getSession().then(r => r.data.session),
            new Promise((_, rej) => setTimeout(() => rej(new Error('lock-timeout')), 3000)),
        ]);
        if (session?.access_token) return session.access_token;
    } catch { /* lock atascado → fallback */ }

    // 2) Fallback: leer el token directo de localStorage, sin pasar por el lock
    try {
        const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
        const parsed = raw ? JSON.parse(raw) : null;
        const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
        if (token) return token;
    } catch { /* JSON corrupto → tratamos como sin sesión */ }

    throw new Error('No hay sesión activa. Recarga la página e inicia sesión de nuevo.');
}

async function invokeAdminFn(name, body, { timeoutMs = 20000 } = {}) {
    const token = await getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Error ${res.status} llamando a ${name}`);
        if (data?.error) throw new Error(data.error);
        return data;
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error(`Tiempo de espera agotado llamando a ${name}. Revisa tu conexión e intenta de nuevo.`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function adminListBusinesses() {
    return invokeAdminFn('admin-list-businesses');
}

export async function adminUpdateBusiness(businessId, updates) {
    return invokeAdminFn('admin-update-business', { business_id: businessId, updates });
}

export async function adminResetPassword(businessId, email) {
    return invokeAdminFn('admin-update-business', { business_id: businessId, reset_password_email: email });
}

// Alta de tenant (AdminOnboarding). phone_number_id/whatsapp_token pueden ir
// vacíos: la Edge Function inserta '' y se configuran después desde el panel.
export async function adminOnboardTenant(form) {
    return invokeAdminFn('onboard-tenant', form, { timeoutMs: 30000 });
}
