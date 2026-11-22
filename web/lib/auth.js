import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
/**
 * Who is signed in, and what they may open. One login can be customer + partner + driver.
 * Admin is only ever granted by the owner in the database (profiles.role = 'admin').
 */
export const getSession = cache(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return { user: null, profile: null, roles: null };
    const [profileRes, partnerRes, driverRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone, role, lang, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('partners').select('id, status').eq('owner_id', user.id),
        supabase.from('driver_profiles').select('user_id, is_verified, status').eq('user_id', user.id).maybeSingle(),
    ]);
    const profile = profileRes.data ?? null;
    const roles = {
        customer: true,
        partner: (partnerRes.data?.length ?? 0) > 0,
        driver: !!driverRes.data,
        admin: profile?.role === 'admin',
    };
    return { user, profile, roles };
});
/** Only allow returning to pages on this site (prevents open redirects). */
export function safeNext(next, fallback = '/account') {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
        return fallback;
    return next;
}
