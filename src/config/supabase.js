import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scjvhrzdlnwktzcejrgl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjanZocnpkbG53a3R6Y2VqcmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDM4NjUsImV4cCI6MjA4NzQ3OTg2NX0.7kKXHrSYLxcYg9KiuOtHJ9tfE0muI9Xu1TShWfVdofU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Business ID siempre desde la URL
export const BUSINESS_ID = parseInt(
    new URLSearchParams(window.location.search).get('bid') || '1'
);
