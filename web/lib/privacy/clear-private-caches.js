// Client helper: remove cached copies of private dashboard pages (Cache Storage).
// Call it on sign-out and when access is revoked. It cannot fix a service worker that caches private
// routes in the first place; that is a server/worker change owned by Codex (see AI-HANDOFF, Phase 1).

/** Path prefixes that must never be served from a cache. Keep in sync with sw.template.js and middleware.js. */
export const PRIVATE_PATH_PREFIXES = Object.freeze([
  '/account', '/cab', '/drive', '/admin', '/partner', '/trips', '/login', '/t',
  '/founder', '/ceo', '/co-founder', '/employee', '/leadership', '/management',
]);

export function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Deletes cached requests for private paths. Resolves to the number removed; never throws. */
export async function clearPrivateCaches(cacheStorage = globalThis.caches) {
  if (!cacheStorage || typeof cacheStorage.keys !== 'function') return 0;
  let removed = 0;
  try {
    const names = await cacheStorage.keys();
    for (const name of names) {
      const cache = await cacheStorage.open(name);
      const requests = await cache.keys();
      for (const request of requests) {
        let pathname = '';
        try {
          pathname = new URL(request.url).pathname;
        } catch {
          continue;
        }
        if (isPrivatePath(pathname) && (await cache.delete(request))) removed += 1;
      }
    }
  } catch {
    /* best effort */
  }
  return removed;
}

/** Prefix for offline drafts saved by village office forms (Step 02). Drafts are cleared on sign-out. */
export const DRAFT_PREFIX = 'thh.draft.';

/** Removes offline drafts from localStorage. Returns the number removed; never throws. */
export function clearOfflineDrafts(storage = globalThis.localStorage) {
  let removed = 0;
  try {
    if (!storage) return 0;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    for (const k of keys) { storage.removeItem(k); removed += 1; }
  } catch {
    /* storage unavailable */
  }
  return removed;
}
