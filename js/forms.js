// Schema-driven forms used by the partner and admin portals.
// A schema is a list of fields: { name, label, type, required, options, hint, ... }.
import { h, field, input, textarea, select, toast, busy, clear } from './ui.js';
import { t, pick, getLang } from './i18n.js';
import { uploadImage } from './sb.js';
import { user } from './store.js';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
};

export function buildForm(schema, values = {}, { onSubmit, submitLabel, ctx = {} } = {}) {
  const getters = {};
  const form = h('form', { class: 'stack form-grid', novalidate: false });

  for (const f of schema) {
    if (f.when && !f.when(values)) continue;
    const v = values[f.name] ?? f.default;
    let el; let getter;
    switch (f.type) {
      case 'textarea':
        el = textarea({ name: f.name, rows: f.rows || 4, maxlength: f.max, required: f.required }, v ?? '');
        getter = () => el.value.trim();
        break;
      case 'number':
        el = input({ name: f.name, type: 'number', min: f.min, max: f.max, step: f.step || 1, required: f.required, value: v ?? '' });
        getter = () => (el.value === '' ? (f.nullable ? null : 0) : Number(el.value));
        break;
      case 'select':
        el = select(typeof f.options === 'function' ? f.options(ctx) : f.options, v ?? '', { name: f.name, required: f.required });
        getter = () => (el.value === '' && f.nullable ? null : el.value);
        break;
      case 'bool': {
        el = h('input', { type: 'checkbox', name: f.name });
        el.checked = !!v;
        getter = () => el.checked;
        form.append(h('label', { class: 'check' }, el, h('span', {}, f.label)));
        getters[f.name] = getter;
        continue;
      }
      case 'tags':
        el = input({ name: f.name, value: (v || []).join(', '), placeholder: f.placeholder || 'a, b, c' });
        getter = () => el.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, f.maxItems || 40);
        break;
      case 'multi': {
        const opts = typeof f.options === 'function' ? f.options(ctx) : f.options;
        const chosen = new Set(v || []);
        el = h('div', { class: 'chips' }, opts.map(([val, label]) => {
          const b = h('button', { type: 'button', class: `pill${chosen.has(val) ? ' active' : ''}`, onclick: () => {
            if (chosen.has(val)) chosen.delete(val); else chosen.add(val); b.classList.toggle('active'); } }, label);
          return b;
        }));
        getter = () => [...chosen];
        break;
      }
      case 'datetime':
        el = input({ name: f.name, type: 'datetime-local', required: f.required, value: toLocalInput(v) });
        getter = () => (el.value ? new Date(el.value).toISOString() : null);
        break;
      case 'images':
        ({ el, getter } = imagesField(f, v || []));
        break;
      case 'image':
        ({ el, getter } = imagesField({ ...f, single: true }, v ? [v] : []));
        { const g = getter; getter = () => g()[0] || null; }
        break;
      case 'days':
        ({ el, getter } = daysField(v || [], ctx));
        break;
      default:
        el = input({ name: f.name, type: f.inputType || 'text', maxlength: f.max, minlength: f.min, required: f.required, value: v ?? '', pattern: f.pattern, placeholder: f.placeholder || '' });
        getter = () => el.value.trim();
    }
    getters[f.name] = getter;
    form.append(h('div', { class: f.wide || ['textarea', 'images', 'days', 'multi'].includes(f.type) ? 'span-2' : '' }, field(f.label + (f.required ? ' *' : ''), el, f.hint)));
  }

  const submit = h('button', { class: 'btn', type: 'submit' }, submitLabel || t('save'));
  form.append(h('div', { class: 'span-2 actions' }, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
    await busy(submit, () => onSubmit(data));
  });
  return form;
}

function imagesField(f, initial) {
  const urls = [...initial];
  const list = h('div', { class: 'thumbs' });
  const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: !f.single, class: 'file-input' });
  const urlIn = input({ type: 'url', placeholder: 'https://…', 'aria-label': 'Image URL' });
  const paint = () => {
    clear(list);
    urls.forEach((u, i) => list.append(h('div', { class: 'thumb' },
      h('img', { src: u, alt: '' }),
      h('button', { type: 'button', class: 'thumb-x', 'aria-label': t('delete'), onclick: () => { urls.splice(i, 1); paint(); } }, '✕'),
      i > 0 && !f.single ? h('button', { type: 'button', class: 'thumb-first', title: 'Make cover', onclick: () => { urls.unshift(...urls.splice(i, 1)); paint(); } }, '★') : null)));
  };
  fileIn.addEventListener('change', async () => {
    const files = [...fileIn.files];
    for (const file of files) {
      try {
        const url = await uploadImage(file, user().id);
        if (f.single) urls.splice(0, urls.length, url); else urls.push(url);
        paint();
      } catch (err) { toast(err.message, 'err'); }
    }
    fileIn.value = '';
  });
  const addUrl = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
    const v = urlIn.value.trim();
    if (!/^https:\/\//.test(v)) { toast('https:// link', 'warn'); return; }
    if (f.single) urls.splice(0, urls.length, v); else urls.push(v);
    urlIn.value = ''; paint();
  } }, t('add'));
  paint();
  const hi = getLang() === 'hi';
  const el = h('div', { class: 'images-field' }, list,
    h('label', { class: 'btn btn-ghost btn-sm upload-btn' }, hi ? '📷 फ़ोटो अपलोड करें' : '📷 Upload photos', fileIn),
    h('div', { class: 'row-inline' }, urlIn, addUrl),
    h('small', { class: 'muted' }, hi ? 'JPG/PNG/WebP, 5 MB तक। पहली फ़ोटो कवर बनेगी।' : 'JPG/PNG/WebP up to 5 MB. The first photo is the cover.'));
  return { el, getter: () => [...urls] };
}

// Day-by-day editor for curated itineraries (English + Hindi).
function daysField(initial, ctx) {
  const days = initial.map((d) => ({ ...d }));
  const box = h('div', { class: 'day-editor' });
  const locOpts = [['', '—'], ...(ctx.locations || []).map((l) => [l.slug, pick(l, 'name')])];
  const paint = () => {
    clear(box);
    days.forEach((d, i) => {
      const mk = (key, ph, area) => {
        const el = area ? textarea({ rows: 2, placeholder: ph }, d[key] || '') : input({ value: d[key] || '', placeholder: ph });
        el.addEventListener('input', () => { d[key] = el.value; });
        return el;
      };
      const loc = select(locOpts, d.location || '');
      loc.addEventListener('change', () => { d.location = loc.value; });
      box.append(h('div', { class: 'day-card' },
        h('div', { class: 'day-num' }, `${t('day')} ${i + 1}`),
        h('div', { class: 'day-fields' },
          h('div', { class: 'row2' }, mk('title', 'Title (English)'), mk('title_hi', 'शीर्षक (हिंदी)')),
          h('div', { class: 'row2' }, mk('plan', 'Plan (English)', true), mk('plan_hi', 'प्लान (हिंदी)', true)),
          loc),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('delete'), onclick: () => { days.splice(i, 1); paint(); } }, '✕')));
    });
    box.append(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { days.push({ title: '', plan: '', location: '' }); paint(); } }, `+ ${t('day')}`));
  };
  paint();
  return { el: box, getter: () => days.map((d, i) => ({ ...d, day: i + 1 })) };
}

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
