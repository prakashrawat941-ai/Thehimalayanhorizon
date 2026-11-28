import { STATUS, tr } from '@/lib/modules/labels';
import { optionsOf } from '@/lib/modules/entities';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

/** Display text for one cell (no business calculation; values come from the server). */
export function cellText(col, row, lang = 'en') {
  const t = tr(lang);
  const v = row[col.key];
  if (v === null || v === undefined || v === '') return '—';
  switch (col.kind) {
    case 'money': return typeof v === 'number' ? inr.format(v) : String(v);
    case 'percent': return `${v}%`;
    case 'status': return t(STATUS[v] || [String(v).replace(/_/g, ' ')]);
    case 'option': { const o = optionsOf(col.options).find((x) => x.value === v); return o ? t(o.label) : String(v); }
    case 'datetime': {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    }
    case 'date': {
      const d = new Date(`${v}T00:00:00+05:30`);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
    }
    default: return String(v);
  }
}

/** Label for a record field, from the entity's columns, form fields or the key itself. */
export function fieldLabel(entity, key, lang = 'en') {
  const t = tr(lang);
  const c = entity.columns?.find((x) => x.key === key);
  if (c) return t(c.label);
  const f = entity.form?.fields?.find((x) => x.key === key);
  if (f) return t(f.label);
  const extra = { executionStatus: ['Execution', 'क्रियान्वयन'], mfa: ['Two-step verification', 'दो-चरण सत्यापन'], reason: ['Reason', 'कारण'], details: ['Details', 'विवरण'], notes: ['Notes', 'नोट'], body: ['Text', 'पाठ'] };
  return t(extra[key] || [key]);
}

export function detailText(entity, key, row, lang) {
  const c = entity.columns?.find((x) => x.key === key);
  if (c) return cellText(c, row, lang);
  const f = entity.form?.fields?.find((x) => x.key === key);
  if (f?.type === 'select') return cellText({ key, kind: 'option', options: f.options }, row, lang);
  if (f?.type === 'money') return cellText({ key, kind: 'money' }, row, lang);
  if (f?.type === 'date') return cellText({ key, kind: 'date' }, row, lang);
  const v = row[key];
  return v === null || v === undefined || v === '' ? '—' : String(v);
}
