import { supabase } from '../config/supabase';

export async function adminListBusinesses() {
    const { data, error } = await supabase.functions.invoke('admin-list-businesses');
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function adminUpdateBusiness(businessId, updates) {
    const { data, error } = await supabase.functions.invoke('admin-update-business', {
        body: { business_id: businessId, updates },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function adminResetPassword(businessId, email) {
    const { data, error } = await supabase.functions.invoke('admin-update-business', {
        body: { business_id: businessId, reset_password_email: email },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
}
