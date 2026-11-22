export const inr = (n) => n == null ? '' : '₹' + Number(n).toLocaleString('en-IN');
export const fmtDate = (d, lang = 'en') => d ? new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
/** URL piece from a name: "Chopta Meadow Stay" → "chopta-meadow-stay". */
export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'listing';
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** Listing URLs look like /homestays/chopta-meadow-stay-<id>; the id at the end is what we look up. */
export const listingSlug = (name, id) => `${slugify(name)}-${id}`;
export const idFromSlug = (slug) => slug.match(UUID_RE)?.[1] ?? null;
/** Distance between two points in km (straight line). Used for "nearby", always shown as approximate. */
export function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}
/** Edit distance, for "Did you mean…" search suggestions. */
export function editDistance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[b.length];
}
