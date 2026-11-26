// Public content from the existing Supabase database (CMS tables + approved listings).
// Everything here is readable by visitors under the database's own security rules.
import { cache } from 'react';
import { publicDb } from '@/lib/supabase/server';
import { homestayPublicationIssues } from '@/lib/publication';
async function rows(promise) {
    const { data, error } = await promise;
    if (error) {
        console.error('[data]', error.message);
        return [];
    }
    return data ?? [];
}
async function one(promise) {
    const { data, error } = await promise;
    if (error) {
        console.error('[data]', error.message);
        return null;
    }
    return data ?? null;
}
export const getSettings = cache(async () => {
    const list = await rows(publicDb().from('site_settings').select('key, value'));
    return Object.fromEntries(list.map((r) => [r.key, r.value]));
});
export const getHomeSections = cache(() => rows(publicDb().from('home_sections').select('*').eq('enabled', true).order('position')));
export const getThemes = cache(() => rows(publicDb().from('themes').select('*').eq('is_published', true).order('position')));
export const getLocations = cache(() => rows(publicDb().from('locations').select('*').eq('is_published', true).order('position')));
export const getLocation = cache((slug) => one(publicDb().from('locations').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()));
export const getItineraries = cache(() => rows(publicDb().from('itineraries').select('*').eq('is_published', true)
    .order('is_featured', { ascending: false }).order('position')));
export const getItinerary = cache((slug) => one(publicDb().from('itineraries').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()));
export const getReviews = cache((locationId) => rows(publicDb().from('destination_reviews').select('id, rating, body, created_at')
    .eq('location_id', locationId).eq('status', 'approved').order('created_at', { ascending: false }).limit(20)));
export const getPlaces = cache(() => rows(publicDb().from('places').select('id, name, name_hi, district, region, kind, lat, lng, aliases, location_id').eq('is_active', true).order('name')));
export const KINDS = {
    homestay: { table: 'homestays', route: '/homestays', nameField: 'name', priceField: 'price_per_night', unit: 'per_night' },
    workspace: { table: 'workspaces', route: '/workspaces', nameField: 'name', priceField: 'price_per_day', unit: 'per_day' },
    village_tour: { table: 'village_tours', route: '/village-tours', nameField: 'title', priceField: 'price_per_person', unit: 'per_person' },
};
export const getListings = cache(async (kind, opts = {}) => {
    let q = publicDb().from(KINDS[kind].table).select('*').eq('status', 'approved')
        .order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    if (opts.locationId)
        q = q.eq('location_id', opts.locationId);
    if (opts.limit && kind !== 'homestay')
        q = q.limit(opts.limit);
    const list = await rows(q);
    const ready = kind === 'homestay' ? list.filter((h) => !homestayPublicationIssues(h).length) : list;
    return opts.limit ? ready.slice(0, opts.limit) : ready;
});
export const getListing = cache(async (kind, id) => {
    const listing = await one(publicDb().from(KINDS[kind].table).select('*').eq('id', id).eq('status', 'approved').maybeSingle());
    return kind === 'homestay' && listing && homestayPublicationIssues(listing).length ? null : listing;
});
export const getRooms = cache((homestayId) => rows(publicDb().from('homestay_rooms').select('*').eq('homestay_id', homestayId).eq('is_active', true).order('sort').order('base_price')));
