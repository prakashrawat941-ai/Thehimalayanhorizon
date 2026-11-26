'use client';
import { PlaceSearch } from '@/components/PlaceSearch';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

/**
 * Simple editor for a content table (admin only; the database checks it too).
 * fields: [{ name, label, type: text|textarea|number|bool|select|list|json|image, options, required }]
 */
export function CrudTable({ lang, table, rows, fields, titleField, subField, defaults = {}, idField = 'id', userId, placeLabels }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [edit, setEdit] = useState(null); // row being edited (or {} for new)
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toForm = (r) => Object.fromEntries(fields.map((f) => [f.name,
    f.type === 'list' ? (r[f.name] || []).join(', ') : f.type === 'json' ? JSON.stringify(r[f.name] ?? (f.empty ?? null), null, 2) : r[f.name] ?? (f.type === 'bool' ? false : '')]));
  const [v, setV] = useState({});
  const [picked, setPicked] = useState(null);
  const [weather, setWeather] = useState('');
  useEffect(() => {
    if (!picked || picked.lat == null || picked.lng == null) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ latitude: picked.lat, longitude: picked.lng, current: 'temperature_2m', timezone: 'Asia/Kolkata' });
    fetch('https://api.open-meteo.com/v1/forecast?' + params, {signal: controller.signal})
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (controller.signal.aborted) return;
        const current = data?.current;
        setWeather(current?.temperature_2m != null ? current.temperature_2m + ' °C · ' + current.time.replace('T',' ') + ' IST · Open-Meteo' : '—');
      }).catch(() => { if (!controller.signal.aborted) setWeather('—'); });
    return () => controller.abort();
  }, [picked]);
  function pickLocation(place) {
    const known = rows.find(row => row.id === place.location_id || (place.slug && row.slug === place.slug) ||
      (row.lat != null && row.lng != null && place.lat != null && place.lng != null &&
       row.name.trim().toLowerCase() === place.name.trim().toLowerCase() &&
       Math.abs(row.lat-place.lat)<0.001 && Math.abs(row.lng-place.lng)<0.001));
    setWeather('');
    if (known) {
      open(known);
    } else {
      const district = place.district || '';
      const districtKey = district.toLowerCase().replace(/\s+district$/, '').trim();
      const regions = {almora:'Kumaon', bageshwar:'Kumaon', champawat:'Kumaon', nainital:'Kumaon', pithoragarh:'Kumaon', 'udham singh nagar':'Kumaon', chamoli:'Garhwal', dehradun:'Garhwal', haridwar:'Garhwal', 'pauri garhwal':'Garhwal', rudraprayag:'Garhwal', 'tehri garhwal':'Garhwal', uttarkashi:'Garhwal'};
      const slug = place.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
      setV(previous => ({...previous, name:place.name, name_hi:place.name_hi || previous.name_hi, slug:previous.slug || slug, district, region:regions[districtKey] || '', lat:place.lat ?? '', lng:place.lng ?? '',
        kind: ['town','village','transport_hub'].includes(place.kind) ? place.kind : previous.kind || 'destination',
        summary:previous.summary || [place.name,district,place.state].filter(Boolean).join(', ')}));
    }
    setPicked(place);
  }
  const open = (r) => { setPicked(null); setWeather(''); setErr(''); setEdit(r); setV(toForm({...defaults, ...r})); };
  async function upload(name, file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return setErr(L('JPG, PNG or WebP under 5 MB.', 'JPG, PNG या WebP, 5 MB से कम।'));
    const db = browserDb();
    const path = `${userId}/cms-${Date.now()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error } = await db.storage.from('media').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '31536000' });
    if (error) return setErr(error.message);
    setV((c) => ({ ...c, [name]: db.storage.from('media').getPublicUrl(path).data.publicUrl }));
  }
  async function save() {
    setErr('');
    const row = {};
    for (const f of fields) {
      let val = v[f.name];
      if (f.type === 'number') val = val === '' || val == null ? null : Number(val);
      else if (f.type === 'list') val = String(val || '').split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'json') { try { val = val === '' ? null : JSON.parse(val); } catch { return setErr(`${f.label}: ${L('not valid JSON', 'सही JSON नहीं')}`); } }
      else if (f.type === 'bool') val = !!val;
      else if (typeof val === 'string') val = val.trim() === '' ? null : val.trim();
      if (f.required && (val == null || val === '')) return setErr(`${f.label}: ${L('required', 'ज़रूरी')}`);
      if (f.name === 'slug' && val && !/^[a-z0-9-]{2,80}$/.test(val)) return setErr(L('Slug: lowercase letters, numbers and dashes only.', 'स्लग: सिर्फ़ छोटे अक्षर, अंक और डैश।'));
      row[f.name] = val;
    }
    setBusy(true);
    const db = browserDb();
    const { error } = edit?.[idField] ? await db.from(table).update(row).eq(idField, edit[idField]) : await db.from(table).insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    setEdit(null); router.refresh();
  }
  async function remove() {
    if (!window.confirm(L('Delete this item? This cannot be undone.', 'यह आइटम हटाएँ? यह वापस नहीं होगा।'))) return;
    setBusy(true);
    const { error } = await browserDb().from(table).delete().eq(idField, edit[idField]);
    setBusy(false);
    if (error) return setErr(error.message);
    setEdit(null); router.refresh();
  }
  const input = (f) => {
    const val = v[f.name] ?? '';
    const on = (e) => setV({ ...v, [f.name]: f.type === 'bool' ? e.target.checked : e.target.value });
    if (f.type === 'bool') return <label className="check"><input type="checkbox" checked={!!val} onChange={on} /> {f.label}</label>;
    const control = f.type === 'textarea' || f.type === 'json' ? <textarea className="input mono-area" rows={f.type === 'json' ? 8 : 4} value={val} onChange={on} />
      : f.type === 'select' ? <select className="input" value={val} onChange={on}>{placeLabels && f.name === 'region' && !val && <option value="">{L('Select region','क्षेत्र चुनें')}</option>}{f.options.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select>
        : <input className="input" type={f.type === 'number' ? 'number' : 'text'} step="any" value={val} onChange={on} />;
    return (
      <label className="field"><span className="field-label">{f.label}{f.required ? ' *' : ''}</span>{control}
        {f.type === 'image' ? <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(f.name, e.target.files?.[0])} /> : null}
        {f.hint ? <small className="muted">{f.hint}</small> : null}</label>
    );
  };
  return (
    <div className="stack">
      {edit ? (
        <section className="ds-panel stack">
          <h2>{edit[idField] ? L('Edit', 'बदलें') : L('Add new', 'नया जोड़ें')}</h2>
          {placeLabels && !edit[idField] && !picked && <PlaceSearch lang={lang} labels={placeLabels} onPick={pickLocation} placeholder={L('Search for the new location','नई जगह खोजें')} />}
          {placeLabels && picked && <p role="status">{picked.ext ? '© OpenStreetMap contributors' : L('THH catalogue','THH सूची')} · {picked.name} {weather && <> · {L('Current weather','वर्तमान मौसम')}: {weather}</>}</p>}
          <div className="form-grid">{fields.map((f) => <div key={f.name} className={f.wide || f.type === 'textarea' || f.type === 'json' ? 'span-2' : ''}>{input(f)}</div>)}</div>
          {err ? <p className="form-err" role="alert">{err}</p> : null}
          <div className="row-actions">
            <button type="button" className="btn" disabled={busy} onClick={save}>{L('Save', 'सेव करें')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>{L('Cancel', 'रद्द')}</button>
            {edit[idField] ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>{L('Delete', 'हटाएँ')}</button> : null}
          </div>
        </section>
      ) : <button type="button" className="btn" onClick={() => open({})}>+ {L('Add new', 'नया जोड़ें')}</button>}
      <section className="ds-panel">
        <div className="ds-rows">{rows.map((r) => (
          <button key={r[idField]} type="button" className="ds-row row-btn" onClick={() => open(r)}>
            <span className="grow"><strong>{r[titleField] || '—'}</strong><span>{subField ? subField.map((k) => r[k]).filter((x) => x != null && x !== '').join(' · ') : ''}</span></span>
            {'is_published' in r ? <span className={`badge badge-${r.is_published ? 'approved' : 'draft'}`}>{r.is_published ? L('Published', 'प्रकाशित') : L('Hidden', 'छिपा')}</span> : null}
            {'enabled' in r ? <span className={`badge badge-${r.enabled ? 'approved' : 'draft'}`}>{r.enabled ? L('On', 'चालू') : L('Off', 'बंद')}</span> : null}
          </button>
        ))}</div>
        {!rows.length ? <p className="muted">{L('Nothing yet.', 'अभी कुछ नहीं।')}</p> : null}
      </section>
    </div>
  );
}
