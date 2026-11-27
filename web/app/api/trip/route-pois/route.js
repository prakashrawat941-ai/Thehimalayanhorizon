import { unstable_cache } from 'next/cache';
import { createHash } from 'node:crypto';
import { overpassQuery, snapRoutePois, validateRoute } from '@/lib/trip/route-pois';
import { istDate } from '@/lib/trip/fuel-provider';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const reader = req.body?.getReader();
    if (!reader) return Response.json({ status: 'error' }, { status: 400 });
    const decoder = new TextDecoder();
    let text = '', size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 85_000) {
        await reader.cancel();
        return Response.json({ status: 'error' }, { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    let valid;
    try { valid = validateRoute(JSON.parse(text + decoder.decode())); } catch { valid = null; }
    if (!valid) return Response.json({ status: 'error' }, { status: 400 });
    const { legs, vehicleClass } = valid;
    const query = overpassQuery(legs);
    const key = createHash('sha256').update(query).digest('hex');
    const getOsm = unstable_cache(async () => {
      const result = await fetch(process.env.TRIP_OVERPASS_URL || 'https://overpass-api.de/api/interpreter', {
        method: 'POST', body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(23_000), redirect: 'error', cache: 'no-store',
      });
      if (!result.ok) throw new Error('OSM unavailable');
      const json = await result.json();
      if (json.remark || !Array.isArray(json.elements) || json.elements.length >= 4200) throw new Error('OSM results incomplete');
      return json.elements;
    }, ['thh-osm-corridor-v1', key], { revalidate: 86400 });
    const elements = await getOsm();
    const rates = JSON.parse(process.env.TRIP_TOLL_RATES_JSON || '{}') || {};
    return Response.json(snapRoutePois(legs, elements, vehicleClass, rates, istDate()));
  } catch {
    return Response.json({ status: 'error' }, { status: 502 });
  }
}
