'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LANG_COOKIE } from '@/lib/i18n/constants';

const PHONE_RE = /^[0-9+\s-]{7,20}$/;

/** Saves name, phone, emergency contact and language. Checked here and by database rules. */
export async function saveProfile(_prev, fd) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'auth' };
  const full_name = String(fd.get('full_name') || '').trim();
  const phone = String(fd.get('phone') || '').trim();
  const ecName = String(fd.get('emergency_contact_name') || '').trim();
  const ecPhone = String(fd.get('emergency_contact_phone') || '').trim();
  const lang = fd.get('lang') === 'en' ? 'en' : 'hi';
  if (full_name.length < 2 || full_name.length > 120) return { status: 'error', message: 'name' };
  if (phone && !PHONE_RE.test(phone)) return { status: 'error', message: 'phone' };
  if (ecName.length > 120) return { status: 'error', message: 'ec_name' };
  if (ecPhone && !PHONE_RE.test(ecPhone)) return { status: 'error', message: 'ec_phone' };
  if (ecPhone && phone && ecPhone.replace(/\D/g, '') === phone.replace(/\D/g, '')) return { status: 'error', message: 'ec_same' };
  const { error } = await supabase.from('profiles').update({
    full_name, phone: phone || null, emergency_contact_name: ecName || null, emergency_contact_phone: ecPhone || null, lang,
  }).eq('id', user.id);
  if (error) { console.error('[profile]', error.message); return { status: 'error', message: 'server' }; }
  (await cookies()).set(LANG_COOKIE, lang, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  return { status: 'ok' };
}
