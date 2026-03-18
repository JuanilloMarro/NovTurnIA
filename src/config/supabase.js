import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scjvhrzdlnwktzcejrgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjanZocnpkbG53a3R6Y2VqcmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDM4NjUsImV4cCI6MjA4NzQ3OTg2NX0.7kKXHrSYLxcYg9KiuOtHJ9tfE0muI9Xu1TShWfVdofU';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjanZocnpkbG53a3R6Y2VqcmdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwMzg2NSwiZXhwIjoyMDg3NDc5ODY1fQ.vjLkA7j91TDeTo-TDUrVqPevoqdEehKpbrgXE6AnG78';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Business ID siempre desde la URL
export const BUSINESS_ID = parseInt(
    new URLSearchParams(window.location.search).get('bid') || '1'
);

// ── Auth Token Management ────────────────────────────
const TOKEN_KEY = 'turnia_session_token';

export function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// ── Edge Function Caller ─────────────────────────────
// Wraps supabase.functions.invoke() with auth headers
export async function callEdgeFunction(functionName, body = {}) {
    const token = getAuthToken();

    const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (error) {
        // Supabase SDK wraps edge function errors
        throw new Error(error.message || 'Error en la función del servidor');
    }

    // Edge functions return { error: '...' } for business logic errors
    if (data?.error) {
        const err = new Error(data.error);
        err.status = data.status || 400;
        throw err;
    }

    return data;
}
