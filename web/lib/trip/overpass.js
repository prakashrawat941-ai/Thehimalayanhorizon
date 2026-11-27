const PRIMARY = 'https://overpass-api.de/api/interpreter';
const FALLBACK = 'https://overpass.private.coffee/api/interpreter';

export async function fetchOverpassElements(query, { fetcher = fetch, primary = PRIMARY, fallback = FALLBACK } = {}) {
  const endpoints = [...new Set([primary, fallback].filter(Boolean))];
  for (let index = 0; index < endpoints.length; index++) {
    const url = new URL(endpoints[index]);
    if (url.protocol !== 'https:') throw new Error('Overpass endpoint must use HTTPS');
    const hasFallback = index === 0 && endpoints.length > 1;
    const seconds = hasFallback ? 8 : 11;
    let result;
    try {
      result = await fetcher(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query.replace(/\[timeout:\d+\]/, `[timeout:${seconds}]`) }),
        signal: AbortSignal.timeout((seconds + 1) * 1000),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch (error) {
      if (hasFallback) continue;
      throw error;
    }
    // A 4xx response is intentional. Respect billing, request and rate-limit decisions.
    if (!result.ok) {
      if (hasFallback && result.status >= 500) continue;
      throw new Error('Overpass HTTP ' + result.status);
    }
    try {
      const payload = await result.json();
      if (payload.remark || !Array.isArray(payload.elements) || payload.elements.length >= 4200) {
        throw new Error('Overpass returned incomplete results');
      }
      return payload.elements;
    } catch (error) {
      if (!hasFallback) throw error;
    }
  }
  throw new Error('Overpass unavailable');
}
