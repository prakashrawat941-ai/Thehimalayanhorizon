'use client';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { browserDb } from '@/lib/supabase/client';
import { editDistance, km } from '@/lib/format';
import { Icon } from './Icon';
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
let placesCache = null;
async function loadPlaces() {
    if (placesCache)
        return placesCache;
    const db = browserDb();
    const [p, l] = await Promise.all([
        db.from('places').select('id, name, name_hi, district, kind, lat, lng, aliases, location_id').eq('is_active', true),
        db.from('locations').select('id, slug, name, name_hi, district, kind, lat, lng').eq('is_published', true),
    ]);
    const locs = (l.data || []);
    const slugById = new Map(locs.map((x) => [x.id, x.slug]));
    const list = (p.data || []).map((x) => ({ ...x, aliases: x.aliases || [], slug: x.location_id ? slugById.get(x.location_id) : null }));
    // Destinations that are not in the places list yet.
    const have = new Set(list.map((x) => x.slug).filter(Boolean));
    locs.filter((x) => !have.has(x.slug) && x.lat != null && x.lng != null)
        .forEach((x) => list.push({ id: x.id, name: x.name, name_hi: x.name_hi, district: x.district, kind: x.kind, lat: x.lat, lng: x.lng, aliases: [], slug: x.slug, location_id: x.id }));
    placesCache = list;
    return list;
}
export function PlaceSearch({ lang, labels, autoFocus = false, onPick = null, placeholder = null, initial = '' }) {
    const listId = useId();
    // Picker mode (Trip Planner): items are buttons that hand the place back instead of links.
    const Item = ({ href, place, children, ...rest }) => (onPick
        ? <button type="button" className="psearch-item" onClick={() => { onPick(place); setQ(place.name); setOpen(false); }} {...rest}>{children}</button>
        : <Link className="psearch-item" href={href} {...rest}>{children}</Link>);
    const [q, setQ] = useState(initial);
    const [places, setPlaces] = useState([]);
    const [osm, setOsm] = useState([]);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');
    const [near, setNear] = useState(null);
    const boxRef = useRef(null);
    useEffect(() => { loadPlaces().then(setPlaces).catch(() => setPlaces([])); }, []);
    useEffect(() => {
        const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);
    const label = (p) => (lang === 'hi' && p.name_hi) || p.name;
    // Our own places: prefix / word / substring match on name, Hindi name and spelling variants.
    const { matches, suggestion } = useMemo(() => {
        const n = norm(q);
        if (n.length < 2)
            return { matches: [], suggestion: null };
        const score = (p) => {
            const names = [p.name, p.name_hi, ...p.aliases].filter(Boolean).map(norm);
            let best = 99;
            for (const s of names) {
                if (s === n)
                    best = Math.min(best, 0);
                else if (s.startsWith(n))
                    best = Math.min(best, 1);
                else if (s.split(' ').some((w) => w.startsWith(n)))
                    best = Math.min(best, 2);
                else if (s.includes(n))
                    best = Math.min(best, 3);
            }
            return best;
        };
        const m = places.map((p) => ({ p, s: score(p) })).filter((x) => x.s < 99)
            .sort((a, b) => a.s - b.s || (b.p.slug ? 1 : 0) - (a.p.slug ? 1 : 0) || a.p.name.localeCompare(b.p.name)).slice(0, 8).map((x) => x.p);
        let sug = null;
        if (!m.length && n.length >= 3) {
            // Typo tolerance: closest spelling within a small edit distance.
            let bestD = Math.max(2, Math.floor(n.length / 3)) + 1;
            for (const p of places) {
                for (const s of [p.name, ...p.aliases].map(norm)) {
                    const d = editDistance(n, s.slice(0, Math.max(n.length, Math.min(s.length, n.length + 2))));
                    if (d < bestD) {
                        bestD = d;
                        sug = p;
                    }
                }
            }
        }
        return { matches: m, suggestion: sug };
    }, [q, places]);
    // Any Indian village/town from OpenStreetMap (Photon), after a short pause in typing.
    useEffect(() => {
        const n = q.trim();
        if (n.length < 3) {
            setOsm([]);
            return;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => {
            fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(n)}&limit=6&lang=${lang === 'hi' ? 'default' : 'en'}&bbox=68.1,6.5,97.4,35.7`, { signal: ctrl.signal })
                .then((r) => (r.ok ? r.json() : { features: [] }))
                .then((j) => {
                const hits = (j.features || []).filter((f) => (f.properties.country || '').match(/India|भारत/i) || f.properties.countrycode === 'IN')
                    .map((f) => ({
                    key: `${f.properties.osm_type}${f.properties.osm_id}`,
                    name: f.properties.name || n,
                    sub: [f.properties.county || f.properties.district || f.properties.city, f.properties.state].filter(Boolean).join(', '),
                    lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
                }));
                setOsm(hits);
            }).catch(() => { });
        }, 350);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [q, lang]);
    const ourHref = (p) => (p.slug ? `/destinations/${p.slug}` : `/plan?to=${encodeURIComponent(p.name)}&lat=${p.lat}&lng=${p.lng}`);
    const osmFiltered = osm.filter((o) => !matches.some((m) => norm(m.name) === norm(o.name) && km(m, o) < 5));
    function locateMe() {
        setNote(labels.locating);
        setNear(null);
        setOpen(true);
        if (!navigator.geolocation) {
            setNote(labels.location_denied);
            return;
        }
        navigator.geolocation.getCurrentPosition((pos) => {
            const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            let best = null;
            for (const p of places) {
                const d = km(me, p);
                if (!best || d < best.d)
                    best = { p, d };
            }
            setNear(best);
            setNote('');
        }, () => setNote(labels.location_denied), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }
    const showList = open && (q.trim().length >= 2 || note || near);
    return (<div className="psearch" ref={boxRef}>
      <div className="psearch-box">
        <Icon name="search" size={20}/>
        <input type="search" value={q} placeholder={placeholder || labels.search_places} aria-label={placeholder || labels.search_places} autoFocus={autoFocus} enterKeyHint="search" autoComplete="off" role="combobox" aria-expanded={!!showList} aria-controls={listId} onChange={(e) => { setQ(e.target.value); setOpen(true); setNote(''); setNear(null); }} onFocus={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Escape')
        setOpen(false); }}/>
        <button type="button" className="psearch-loc" onClick={locateMe}><Icon name="locate" size={18}/><span>{labels.use_location}</span></button>
      </div>
      {showList ? (<div className="psearch-list" id={listId} role="listbox">
          {note ? <p className="psearch-note">{note}</p> : null}
          {near ? (<>
              <h4>{labels.nearest_place}</h4>
              <Item href={ourHref(near.p)} place={near.p}><Icon name="pin" size={18}/>
                <span>{label(near.p)}<small>{near.d.toFixed(0)} {labels.km_away}{near.p.district ? ` · ${near.p.district}` : ''}</small></span></Item>
            </>) : null}
          {matches.length ? <h4>{labels.our_places}</h4> : null}
          {matches.map((p) => (<Item key={p.id} href={ourHref(p)} place={p} role="option" aria-selected={false}>
              <Icon name={p.slug ? 'mountain' : 'pin'} size={18}/>
              <span>{label(p)}<small>{[p.district, p.slug ? null : labels.no_page_yet].filter(Boolean).join(' · ')}</small></span>
            </Item>))}
          {!matches.length && suggestion ? (<p className="psearch-dym">{labels.did_you_mean} <button type="button" onClick={() => setQ(suggestion.name)}>{label(suggestion)}</button>?</p>) : null}
          {osmFiltered.length ? <h4>{labels.more_places}</h4> : null}
          {osmFiltered.map((o) => (<Item key={o.key} href={`/plan?to=${encodeURIComponent(o.name)}&lat=${o.lat}&lng=${o.lng}`} place={{ name: o.name, lat: o.lat, lng: o.lng, district: o.sub, ext: true }} role="option" aria-selected={false}>
              <Icon name="pin" size={18}/><span>{o.name}<small>{[o.sub, labels.no_page_yet].filter(Boolean).join(' · ')}</small></span>
            </Item>))}
          {q.trim().length >= 2 && !matches.length && !suggestion && !osmFiltered.length && !note ? <p className="psearch-note">{labels.nothing_here}</p> : null}
        </div>) : null}
    </div>);
}
