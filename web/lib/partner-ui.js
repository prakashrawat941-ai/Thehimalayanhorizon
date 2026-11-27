// Display-only helpers for the partner portal (no database writes here).

/** Checklist that shows how complete a homestay listing is. Uses only fields the host fills in. */
export function listingHealth(h, rooms = [], L = (en) => en) {
  const rs = rooms.filter((r) => r.homestay_id === h.id && r.is_active !== false);
  const photos = (h.images || []).length;
  const items = [
    { key: 'basic', ok: !!(h.name && h.village && h.district && (h.summary || '').length >= 10), label: L('Name, place and summary', 'नाम, जगह और परिचय') },
    { key: 'rooms', ok: rs.length > 0 && rs.every((r) => Number(r.base_price) > 0), label: L('Rooms and prices', 'कमरे और किराया') },
    { key: 'photos', ok: photos >= 5, label: photos >= 5 ? L(`${photos} real photos`, `${photos} असली फ़ोटो`) : L(`Photos: ${photos} of at least 5`, `फ़ोटो: ${photos} (कम से कम 5)`) },
    { key: 'rules', ok: /Check-in:/.test(h.house_rules || ''), label: L('House rules & check-in time', 'घर के नियम और चेक-इन समय') },
    { key: 'map', ok: !!h.location_id, label: L('Nearest place on the map', 'नक्शे पर पास की जगह') },
  ];
  const done = items.filter((i) => i.ok).length;
  return { items, done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

/** Adds n days to an ISO date (YYYY-MM-DD). */
export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Groups bookings for the overview "next 7 days" list. */
export function nextDays(bookings, today, days = 7) {
  const end = addDays(today, days);
  const out = [];
  for (const b of bookings) {
    if (b.status === 'confirmed' && b.start_date >= today && b.start_date <= end) out.push({ b, type: 'arrive', date: b.start_date });
    if (['confirmed', 'checked_in'].includes(b.status) && b.end_date !== b.start_date && b.end_date >= today && b.end_date <= end) out.push({ b, type: 'leave', date: b.end_date });
  }
  return out.sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : a.type === 'leave' ? -1 : 1));
}
