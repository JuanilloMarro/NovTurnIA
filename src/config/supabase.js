import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Business ID — auto-detect desde login, con ?bid= como fallback para desarrollo
// En producción: se detecta automáticamente del perfil del usuario
// En desarrollo: se puede forzar con ?bid=2 en la URL
const urlBid = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('bid') : null;
export let BUSINESS_ID = urlBid ? parseInt(urlBid) : 0;

// Setter para actualizar el BUSINESS_ID después del login
export function setBusinessId(id) {
    BUSINESS_ID = id;
}
