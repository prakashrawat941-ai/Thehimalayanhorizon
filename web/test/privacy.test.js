import { describe, it, expect } from 'vitest';
import { isPrivatePath, clearPrivateCaches, PRIVATE_PATH_PREFIXES } from '@/lib/privacy/clear-private-caches';

function fakeCaches(urls) {
  const store = new Map([['pages', new Set(urls)]]);
  return {
    keys: async () => [...store.keys()],
    open: async (name) => ({
      keys: async () => [...store.get(name)].map((url) => ({ url })),
      delete: async (req) => store.get(name).delete(req.url),
    }),
    _left: () => [...store.get('pages')],
  };
}

describe('private path detection', () => {
  it('flags dashboard and account routes', () => {
    for (const p of ['/account', '/account/bookings', '/admin/x', '/partner/kyc', '/founder', '/ceo/approvals']) expect(isPrivatePath(p), p).toBe(true);
  });
  it('leaves public pages alone and does not match by loose prefix', () => {
    for (const p of ['/', '/villages', '/accounting', '/tasty', '/offline']) expect(isPrivatePath(p), p).toBe(false);
  });
  it('lists every management dashboard prefix', () => {
    for (const p of ['/founder', '/ceo', '/co-founder', '/employee']) expect(PRIVATE_PATH_PREFIXES).toContain(p);
  });
});

describe('clearPrivateCaches', () => {
  it('removes only private entries', async () => {
    const c = fakeCaches(['https://x.test/', 'https://x.test/villages', 'https://x.test/account/bookings', 'https://x.test/admin']);
    expect(await clearPrivateCaches(c)).toBe(2);
    expect(c._left()).toEqual(['https://x.test/', 'https://x.test/villages']);
  });
  it('is safe without Cache Storage', async () => {
    expect(await clearPrivateCaches(undefined)).toBe(0);
    expect(await clearPrivateCaches({})).toBe(0);
  });
});
