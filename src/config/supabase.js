import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kwpaaqdkklwwfslhkqpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cGFhcWRra2x3d2ZzbGhrcXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjQ4NTcsImV4cCI6MjA4OTcwMDg1N30.kFj6mkOspwYB8bxn6NxAcRhdHt2IAq5g-LAoabX2mUk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Business ID siempre desde la URL
export const BUSINESS_ID = parseInt(
    new URLSearchParams(window.location.search).get('bid') || '1'
);
