'use server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\s-]{7,20}$/;
// Simple in-memory limit per server instance (the database also limits; see migration).
const hits = new Map();
export async function sendContact(_prev, fd) {
    // Bots fill the hidden field; pretend success and save nothing.
    if (String(fd.get('website') || ''))
        return { status: 'ok' };
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const phone = String(fd.get('phone') || '').trim();
    const message = String(fd.get('message') || '').trim();
    const lang = fd.get('lang') === 'en' ? 'en' : 'hi';
    if (name.length < 2 || name.length > 120)
        return { status: 'error', message: 'name' };
    if (!EMAIL_RE.test(email) || email.length > 254)
        return { status: 'error', message: 'email' };
    if (phone && !PHONE_RE.test(phone))
        return { status: 'error', message: 'phone' };
    if (message.length < 5 || message.length > 3000)
        return { status: 'error', message: 'message' };
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60e3);
    if (recent.length >= 3)
        return { status: 'error', message: 'rate' };
    hits.set(ip, [...recent, now]);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contact_messages').insert({ name, email, phone: phone || null, message, lang, user_id: user?.id ?? null });
    if (error) {
        // Table not created yet (waiting for "DB approved") → say so honestly.
        if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message))
            return { status: 'unavailable' };
        if (/too many messages/i.test(error.message))
            return { status: 'error', message: 'rate' };
        console.error('[contact]', error.message);
        return { status: 'error', message: 'server' };
    }
    return { status: 'ok' };
}
