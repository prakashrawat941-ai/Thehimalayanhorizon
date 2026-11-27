// Homestay page helpers (display only).

/** House rules are stored as labelled lines ("Check-in: 12:00", "Check-out: 11:00", "Cancellation: …") plus free text. */
export function splitHouseRules(text = '') {
  const out = { checkin: '', checkout: '', cancellation: '', rules: [] };
  String(text || '').split('\n').forEach((line) => {
    const m = line.match(/^(Check-in|Check-out|Cancellation): (.*)$/);
    if (m) out[{ 'Check-in': 'checkin', 'Check-out': 'checkout', Cancellation: 'cancellation' }[m[1]]] = m[2].trim();
    else if (line.trim()) out.rules.push(line.trim());
  });
  return { ...out, rules: out.rules.join('\n') };
}

/** Today's date in India as YYYY-MM-DD, shifted by n days. */
export const istDay = (n = 0) => new Date(Date.now() + 5.5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

/** Nights between two ISO dates (0 when invalid). */
export const nightsBetween = (a, b) => (a && b && b > a ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) : 0);
