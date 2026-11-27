'use client';
import { useState } from 'react';
import { adminFuelRateKey } from '@/lib/trip/engine';
import { inr } from '@/lib/format';
import { COST_CATS } from '@/lib/trip/engine';
import { FUELS, MODES } from '@/lib/trip/common';

const has = (o, k) => o && o[k] !== '' && o[k] != null;
const fmtDate = (iso, lang) => (iso ? new Date(`${iso}T12:00:00+05:30`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' }) : '');

/**
 * "How your cost is worked out": every line is filled automatically (live price, route tolls,
 * admin defaults, typical mileage) and can be changed. Overrides live in d.assumptions; "Back to
 * auto" removes them. b = computeBudget() with the effective assumptions; auto = live values used.
 */
export function CostStep({ d, b, auto, defaults, lang, update, onBack, onNext }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [open, setOpen] = useState(null);
  const own = ['car', 'bike'].includes(d.mode);
  const mine = d.assumptions || {};
  const fuel = FUELS.find((f) => f[0] === (mine.fuel_type || 'petrol')) || FUELS[0];
  const mode = MODES.find((m) => m[0] === d.mode);
  const src = (key, autoLabel) => (has(mine, key) ? ['you', L('Your value', 'आपका मान')] : has(auto, key) ? ['live', autoLabel] : has(defaults, key === 'fuel_price' ? adminFuelRateKey(fuel[0]) : key) ? ['admin', L('Admin default', 'एडमिन डिफ़ॉल्ट')] : null);

  const rows = [];
  if (own) {
    const p = src('fuel_price', auto.fuelInfo ? L(`${fuel[1]} · ${auto.fuelInfo.area} · ${fmtDate(auto.fuelInfo.date, lang)}`, `${fuel[2]} · ${auto.fuelInfo.area} · ${fmtDate(auto.fuelInfo.date, lang)}`) : '');
    rows.push({ k: 'fuel', ic: '⛽', bg: '#fde9e2', t: L('Fuel', 'ईंधन'), keys: [['fuel_price', L(`Fuel price (₹/${fuel[3]})`, `ईंधन दाम (₹/${fuel[3]})`)], ['mileage', fuel[0] === 'cng' ? L('Mileage (km per kg)', 'माइलेज (किमी/किग्रा)') : L('Mileage (km per litre)', 'माइलेज (किमी/लीटर)')]],
      chips: [p ? p[1] : L('Price needed', 'दाम चाहिए'), has(mine, 'mileage') ? L('Your mileage', 'आपका माइलेज') : L(`Typical for ${mode?.[1] || d.mode}`, `${mode?.[2] || d.mode} का आम माइलेज`)], warn: !p });
  } else if (d.mode === 'taxi') {
    const r = src('taxi_per_km', '');
    rows.push({ k: 'transport', ic: '🚕', bg: '#eaf2fa', t: L('Taxi fare', 'टैक्सी किराया'), keys: [['taxi_per_km', L('Taxi rate (₹/km)', 'टैक्सी रेट (₹/किमी)')]], chips: [r ? r[1] : L('Rate needed', 'रेट चाहिए')], warn: !r });
  } else {
    const f = src('fare_per_person', '');
    rows.push({ k: 'transport', ic: d.mode === 'train' ? '🚆' : d.mode === 'bus' ? '🚌' : '👥', bg: '#eaf2fa', t: L('Fares', 'किराया'), keys: [['fare_per_person', L('Total fare per person (₹)', 'प्रति व्यक्ति कुल किराया (₹)')]],
      chips: [f ? f[1] : L('Fare not in our data — add it', 'किराया हमारे डेटा में नहीं — भरें')], warn: !f });
  }
  rows.push({ k: 'tolls', ic: '₹', bg: '#efe6fb', t: L('Tolls & parking', 'टोल और पार्किंग'), keys: [['tolls', L('Tolls & parking, total (₹)', 'टोल और पार्किंग, कुल (₹)')]],
    chips: [has(mine, 'tolls') ? L('Your value', 'आपका मान') : auto.tollInfo ? L(`${auto.tollInfo.count} plaza(s) on your route${auto.tollInfo.unknown ? ` · ${auto.tollInfo.unknown} rate(s) unknown` : ''}`, `रास्ते पर ${auto.tollInfo.count} प्लाज़ा${auto.tollInfo.unknown ? ` · ${auto.tollInfo.unknown} का रेट पता नहीं` : ''}`) : L('Toll data not connected yet', 'टोल डेटा अभी जुड़ा नहीं')],
    warn: !has(mine, 'tolls') && (!auto.tollInfo || auto.tollInfo.unknown > 0) });
  const st = src('stay_per_night', '');
  rows.push({ k: 'stay', ic: '🛏', bg: '#e7f2ec', t: L('Stay', 'रुकना'), keys: [['stay_per_night', L('Per room per night (₹)', 'प्रति कमरा प्रति रात (₹)')], ['rooms', L('Rooms per night', 'हर रात कमरे')]],
    chips: [st ? st[1] : L('Rate needed', 'रेट चाहिए'), has(mine, 'rooms') ? L('Your rooms', 'आपके कमरे') : L('Rooms: 2 people per room', 'कमरे: 2 लोग प्रति कमरा')], warn: !st && b.nights > 0 });
  const fd = src('food_per_person_day', '');
  rows.push({ k: 'food', ic: '🍲', bg: '#fdf1dc', t: L('Food', 'खाना'), keys: [['food_per_person_day', L('Per person per day (₹)', 'प्रति व्यक्ति प्रति दिन (₹)')]], chips: [fd ? fd[1] : L('Rate needed', 'रेट चाहिए')], warn: !fd });
  rows.push({ k: 'more', cats: ['activities', 'permits', 'local', 'other'], ic: '🎟', bg: '#eaf2fa', t: L('Entry, activities & local travel', 'एंट्री, गतिविधियाँ और लोकल सफ़र'),
    keys: [['activities', L('Activities (₹)', 'गतिविधियाँ (₹)')], ['permits', L('Permits & entry (₹)', 'परमिट और एंट्री (₹)')], ['local', L('Local transport (₹)', 'लोकल सफ़र (₹)')], ['other', L('Other (₹)', 'अन्य (₹)')]],
    chips: [L('Only what you add', 'सिर्फ़ जो आप भरें')] });
  rows.push({ k: 'reserve', ic: '🛟', bg: '#eef1f3', t: L('Emergency reserve', 'आपात रिज़र्व'), keys: [['reserve_pct', L('Reserve (%)', 'रिज़र्व (%)')]], chips: [L(`${b.a.reserve_pct ?? 0}% of everything above`, `ऊपर के कुल का ${b.a.reserve_pct ?? 0}%`)] });

  const amount = (r) => (r.cats || [r.k]).reduce((s, c) => s + (b.lines[c]?.est || 0), 0);
  const overridden = (r) => r.keys.some(([k]) => has(mine, k));
  const setA = (k, v) => update({ assumptions: { ...mine, [k]: v } });
  const toAuto = (r) => { const n = { ...mine }; r.keys.forEach(([k]) => delete n[k]); update({ assumptions: n }); setOpen(null); };

  return (
    <section className="tp2-cost">
      <div className="tp2-card">
        <h2>{L('How your cost is worked out', 'आपका ख़र्च कैसे बना')}</h2>
        <p className="small muted">{L('Filled in automatically. It updates when you change the route, people or vehicle. Tap “Change” to use your own number.', 'अपने आप भरा जाता है। रास्ता, लोग या गाड़ी बदलते ही बदलता है। अपना नंबर डालने के लिए “बदलें” दबाएँ।')}</p>
        {rows.map((r) => (
          <div className="tp2-cl" key={r.k}>
            <span className="tp2-ci" style={{ background: r.bg }} aria-hidden="true">{r.ic}</span>
            <span className="tp2-cl-tx"><b>{r.t}</b>{!r.cats && b.lines[r.k]?.how ? <small>{b.lines[r.k].how}</small> : null}
              <span className="tp2-src">{r.chips.map((c) => <span key={c} className="tp2-tag">{c}</span>)}
                <button type="button" className="tp2-ovr" aria-expanded={open === r.k} onClick={() => setOpen(open === r.k ? null : r.k)}>{open === r.k ? L('Done', 'हो गया') : L('Change', 'बदलें')}</button>
                {overridden(r) ? <button type="button" className="tp2-ovr" onClick={() => toAuto(r)}>{L('Back to auto', 'अपने आप पर वापस')}</button> : null}</span></span>
            <span className="tp2-amt">{r.warn && !amount(r) ? <span className="tp2-tag warn">{L('Needs a rate', 'रेट चाहिए')}</span> : inr(amount(r))}</span>
            {open === r.k ? (
              <span className="tp2-edit">{r.keys.map(([k, label]) => (
                <label key={k}><span>{label}</span><input type="number" min={0} inputMode="decimal" value={mine[k] ?? ''} placeholder={b.a[k] != null && b.a[k] !== '' ? String(b.a[k]) : ''} onChange={(e) => setA(k, e.target.value)} /></label>
              ))}<small className="muted">{L('Kept with this trip only.', 'सिर्फ़ इस ट्रिप के साथ रहेगा।')}</small></span>
            ) : null}
          </div>
        ))}
        {b.missing.length ? <p className="soft-note warn">{L('Some rates are missing, so the total is lower than the real cost.', 'कुछ रेट नहीं हैं, इसलिए कुल असल से कम है।')}</p> : null}
      </div>

      <div className="tp2-card">
        <h2>{L('Your budget & what you spent', 'आपका बजट और असल ख़र्च')}</h2>
        <label className="field"><span className="field-label">{L('Budget for the whole trip (₹, optional)', 'पूरी यात्रा का बजट (₹, वैकल्पिक)')}</span>
          <input className="input" type="number" min={0} step={500} inputMode="numeric" value={d.budget} onChange={(e) => update({ budget: e.target.value })} /></label>
        <div className="tp2-kpis">
          <div className="tp2-kpi"><small>{L('Left (estimate)', 'बचा (अनुमान)')}</small><b>{b.remaining == null ? '—' : inr(Math.round(b.remaining))}</b></div>
          <div className="tp2-kpi"><small>{L('Left (actual)', 'बचा (असल)')}</small><b>{b.actualRemaining == null || !b.actualTotal ? '—' : inr(Math.round(b.actualRemaining))}</b></div>
        </div>
        <details className="tp2-acc"><summary>{L('Track what you actually spent', 'असल ख़र्च लिखें')}</summary>
          <div className="tp2-acc-in tp2-actuals">{COST_CATS.filter(([k]) => b.lines[k] && !(k === 'fuel' && !own) && !(k === 'transport' && own)).map(([k, en, hi]) => (
            <label key={k}><span>{lang === 'hi' ? hi : en}</span><input type="number" min={0} inputMode="numeric" value={d.actuals?.[k] ?? ''} onChange={(e) => update({ actuals: { ...(d.actuals || {}), [k]: e.target.value } })} /></label>
          ))}</div></details>
      </div>
      <div className="row-actions tp2-only-d">
        <button type="button" className="btn btn-ghost" onClick={onBack}>← {L('Day plan', 'दिन-वार')}</button>
        <button type="button" className="btn" onClick={onNext}>{L('Trip report', 'ट्रिप रिपोर्ट')} →</button>
      </div>
    </section>
  );
}
