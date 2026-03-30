import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kwpaaqdkklwwfslhkqpb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3cGFhcWRra2x3d2ZzbGhrcXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjQ4NTcsImV4cCI6MjA4OTcwMDg1N30.kFj6mkOspwYB8bxn6NxAcRhdHt2IAq5g-LAoabX2mUk');

async function fix() {
    console.log("Fixing...");
    const allPerms = { view_stats: true, manage_roles: true, create_appointments: true, edit_appointments: true, confirm_appointments: true, delete_appointments: true, view_patients: true, create_patients: true, edit_patients: true, delete_patients: true, view_conversations: true, toggle_ai: true };
    const { data: dr, error: er1 } = await supabase.from('staff_roles').select('id, name').ilike('name', 'dentist%');
    console.log("Dentist Roles found:", dr, er1);
    
    if (dr && dr[0]) {
        const { error: er2 } = await supabase.from('staff_roles').update({ permissions: allPerms }).eq('id', dr[0].id);
        console.log("Updated dentist role:", er2 || "Success");
    }

    const { data: sr, error: er3 } = await supabase.from('staff_roles').select('id').ilike('name', 'secretary%');
    console.log("Sec Role found:", sr, er3);
    
    if (sr && sr[0]) {
        // Only insert if doesn't exist
        const { data: exists } = await supabase.from('staff_users').select('id').ilike('email', 'secretaria%').limit(1);
        if (!exists || exists.length === 0) {
            const { error: er4 } = await supabase.from('staff_users').insert({
                business_id: 1,
                full_name: 'Secretaria De Prueba',
                email: 'secretaria@demo.com',
                role_id: sr[0].id,
                firebase_uid: 'sec_test_uid'
            });
            console.log("Inserted Sec user:", er4 || "Success");
        } else {
            console.log("Secretaria user already exists");
        }
    }
}

fix();
