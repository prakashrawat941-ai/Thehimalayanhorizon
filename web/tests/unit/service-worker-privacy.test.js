import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const script = readFileSync(resolve(process.cwd(), 'scripts/sw.template.js'), 'utf8');

async function navigate(path) {
  const handlers = {};
  const writes = [];
  const response = { ok: true, clone() { return this; } };
  const cache = { addAll: async () => {}, put: async (request) => { writes.push(request.url); } };
  const caches = {
    open: async () => cache,
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    location: { origin: 'https://thehimalayanhorizon.example' },
    addEventListener(type, fn) { handlers[type] = fn; },
  };
  runInNewContext(script, { self, caches, fetch: async () => response, URL });
  const request = { method: 'GET', mode: 'navigate', url: `${self.location.origin}${path}` };
  let returned;
  handlers.fetch({ request, respondWith(promise) { returned = promise; } });
  if (returned) await returned;
  await Promise.resolve();
  return writes;
}

describe('private PWA cache boundary', () => {
  it.each([
    '/', '/plan?place=almora', '/account', '/partner/properties', '/admin',
    '/founder', '/ceo', '/co-founder', '/employee', '/management/invite',
    '/cab', '/trips/123', '/login', '/auth/callback', '/api/trip/fuel-price',
  ])('never caches navigation response for %s', async (path) => {
    expect(await navigate(path)).toEqual([]);
  });
});
