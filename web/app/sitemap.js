import { SITE_URL } from '@/lib/config';
import { getItineraries, getListings, getLocations, getThemes, KINDS } from '@/lib/data';
import { listingSlug } from '@/lib/format';
export const revalidate = 3600;
export default async function sitemap() {
    const u = (p) => `${SITE_URL}${p}`;
    const fixed = ['/', '/destinations', '/villages', '/experiences', '/itineraries', '/homestays', '/village-tours', '/workspaces', '/contact', '/faq', '/our-story', '/about']
        .map((p) => ({ url: u(p), changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.7 }));
    const [locs, themes, its, ...lists] = await Promise.all([getLocations(), getThemes(), getItineraries(),
        ...['homestay', 'workspace', 'village_tour'].map((k) => getListings(k))]);
    const kinds = ['homestay', 'workspace', 'village_tour'];
    return [
        ...fixed,
        ...locs.filter((l) => l.kind !== 'transport_hub').map((l) => ({ url: u(`/destinations/${l.slug}`), lastModified: l.updated_at, priority: 0.8 })),
        ...themes.map((th) => ({ url: u(`/experiences/${th.slug}`), lastModified: th.updated_at, priority: 0.6 })),
        ...its.map((it) => ({ url: u(`/itineraries/${it.slug}`), lastModified: it.updated_at, priority: 0.6 })),
        ...lists.flatMap((rows, i) => rows.map((x) => {
            const k = KINDS[kinds[i]];
            return { url: u(`${k.route}/${listingSlug(x[k.nameField], x.id)}`), lastModified: x.updated_at, priority: 0.7 };
        })),
    ];
}
