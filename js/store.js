// Shared app state: signed-in user, profile, partner record and cached lookups.
import { sb, q } from './sb.js';

export const state = {
  session: null,
  profile: null,     // { id, full_name, phone, role, lang }
  partners: [],      // partner records owned by this user
  locations: null,   // published locations (cached)
  themes: null,
  settings: null,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(state));

export const user = () => state.session?.user || null;
export const isAdmin = () => state.profile?.role === 'admin';
export const isPartner = () => state.partners.some((p) => p.status === 'approved') || isAdmin();

export async function loadProfile() {
  const u = user();
  if (!u) { state.profile = null; state.partners = []; emit(); return; }
  const [profile, partners] = await Promise.all([
    q(sb.from('profiles').select('*').eq('id', u.id).maybeSingle()),
    q(sb.from('partners').select('*').eq('owner_id', u.id).order('created_at')),
  ]);
  state.profile = profile;
  state.partners = partners || [];
  emit();
  // Google sign-in: keep the profile name and photo filled (only empty fields are filled).
  const meta = u.user_metadata || {};
  const photo = meta.avatar_url || meta.picture || '';
  const name = meta.full_name || meta.name || '';
  if (profile && ((!profile.avatar_url && photo) || (!profile.full_name && name))) {
    const patch = {};
    if (!profile.avatar_url && photo) patch.avatar_url = photo.slice(0, 500);
    if (!profile.full_name && name) patch.full_name = name.slice(0, 120);
    sb.from('profiles').update(patch).eq('id', u.id).then(({ error }) => { if (!error) { Object.assign(state.profile, patch); emit(); } });
  }
}

export async function initAuth() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadProfile().catch(console.error);
  sb.auth.onAuthStateChange((_event, session) => {
    const changed = session?.user?.id !== state.session?.user?.id;
    state.session = session;
    if (changed) loadProfile().catch(console.error);
  });
}

export async function locations() {
  if (!state.locations) {
    state.locations = await q(sb.from('locations').select('*').eq('is_published', true).order('position'));
  }
  return state.locations;
}
export async function themes() {
  if (!state.themes) {
    state.themes = await q(sb.from('themes').select('*').eq('is_published', true).order('position'));
  }
  return state.themes;
}
export async function settings() {
  if (!state.settings) {
    const rows = await q(sb.from('site_settings').select('key,value'));
    state.settings = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
  }
  return state.settings;
}
export const resetCache = () => { state.locations = null; state.themes = null; state.settings = null; };

export const locationById = (id) => (state.locations || []).find((l) => l.id === id);
export const locationBySlug = (slug) => (state.locations || []).find((l) => l.slug === slug);
