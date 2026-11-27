import { unstable_cache } from 'next/cache';
import { istDate, readSsrDistrict } from '@/lib/trip/fuel-provider';

export const dynamic = 'force-dynamic';

const lookup = unstable_cache(async (lat, lng) => {
  const url = new URL(process.env.TRIP_REVERSE_GEOCODER_URL);
  if (url.protocol !== 'https:') throw new Error('District lookup unavailable');
  for (const [key, value] of Object.entries({ lat, lon: lng, zoom: 8, format: 'jsonv2', addressdetails: 1, 'accept-language': 'en' })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new Error('District lookup unavailable');
  const { address } = await response.json();
  if (address?.country_code !== 'in') return null;
  const state = address.state;
  const district = address.state_district || address.county;
  return typeof state === 'string' && state.length <= 100 && typeof district === 'string' && district.length <= 100
    ? { state, district } : null;
}, ['trip-district-v1'], { revalidate: 86400 });

const loadDistrictPrices = unstable_cache(async (state, district, day) => {
  const url = new URL(process.env.TRIP_FUEL_API_URL);
  if (url.protocol !== 'https:') throw new Error('Fuel provider unavailable');
  url.searchParams.set('state', state);
  const headers = { 'x-api-key': process.env.TRIP_FUEL_API_KEY };
  if (url.hostname.endsWith('.p.rapidapi.com')) {
    delete headers['x-api-key'];
    headers['x-rapidapi-key'] = process.env.TRIP_FUEL_API_KEY;
    headers['x-rapidapi-host'] = url.hostname;
  }
  const res = await fetch(url, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Fuel provider unavailable');
  const prices = readSsrDistrict(await res.json(), state, district, day);
  if (!Object.keys(prices).length) throw new Error('No dated district prices');
  return prices;
}, ['trip-ssr-district-fuel-v1'], { revalidate: 86400 });

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const valid = (key, min, max) => {
    const val = params.get(key);
    return val?.trim() && Number.isFinite(+val) && +val >= min && +val <= max;
  };
  if (!valid('lat', 6, 38) || !valid('lng', 67, 98)) return Response.json({ status: 'unavailable' });
  if (!process.env.TRIP_FUEL_API_KEY || !process.env.TRIP_FUEL_API_URL || !process.env.TRIP_REVERSE_GEOCODER_URL) {
    return Response.json({ status: 'not_connected' });
  }
  try {
    const area = await lookup((+params.get('lat')).toFixed(4), (+params.get('lng')).toFixed(4));
    if (!area) return Response.json({ status: 'unavailable' });
    const prices = await loadDistrictPrices(area.state, area.district, istDate());
    return Response.json({ status: 'ok', area: area.district, source: 'SSR Innovation Lab', prices });
  } catch {
    return Response.json({ status: 'error' }, { status: 502 });
  }
}
