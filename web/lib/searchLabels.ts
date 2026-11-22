import type { T } from '@/lib/i18n/core';

const KEYS = ['search_places', 'use_location', 'locating', 'location_denied', 'nearest_place', 'km_away', 'our_places', 'no_page_yet', 'did_you_mean', 'more_places', 'nothing_here'];
export const searchLabels = (tr: T) => Object.fromEntries(KEYS.map((k) => [k, tr.t(k)]));
