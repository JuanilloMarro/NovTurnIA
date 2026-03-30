import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kwpaaqdkklwwfslhkqpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cGFhcWRra2x3d2ZzbGhrcXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjQ4NTcsImV4cCI6MjA4OTcwMDg1N30.kFj6mkOspwYB8bxn6NxAcRhdHt2IAq5g-LAoabX2mUk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Business ID — auto-detect desde login, con ?bid= como fallback para desarrollo
// En producción: se detecta automáticamente del perfil del usuario
// En desarrollo: se puede forzar con ?bid=2 en la URL
const urlBid = new URLSearchParams(window.location.search).get('bid');
export let BUSINESS_ID = urlBid ? parseInt(urlBid) : 0;

// Setter para actualizar el BUSINESS_ID después del login
export function setBusinessId(id) {
    BUSINESS_ID = id;
}
