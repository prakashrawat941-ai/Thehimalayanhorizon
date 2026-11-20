// Supabase client (loaded from a CDN, so the site needs no build step).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.100.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Run a query and throw a readable error instead of returning { error }.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || 'Something went wrong');
  return data;
}

// Upload an image into the public "media" bucket under the user's own folder.
export async function uploadImage(file, userId) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type || '')) throw new Error('Please choose a JPG, PNG or WebP image');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
