import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
        // Forza al navegador a no cachear respuestas GET (vital para botones "Actualizar")
        fetch: (...args) => {
            return fetch(args[0], { ...args[1], cache: 'no-store' });
        }
    }
});

// T-20: BUSINESS_ID y setBusinessId fueron movidos al store de Zustand (useAppStore).
// Leer: useAppStore.getState().businessId
// Escribir: useAppStore.getState().setBusinessId(id)
