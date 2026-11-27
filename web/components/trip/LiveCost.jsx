'use client';
import { inr } from '@/lib/format';

// Categories shown in the live cost card (engine lines folded into five readable groups).
export const COST_GROUPS = [
  ['travel', ['fuel', 'transport'], '#e36f3c', 'Fuel & fares', 'ईंधन और किराया'],
  ['tolls', ['tolls'], '#8b6ad8', 'Tolls & parking', 'टोल और पार्किंग'],
  ['stay', ['stay'], '#5aa27c', 'Stay', 'रुकना'],
  ['food', ['food'], '#d6b56a', 'Food', 'खाना'],
  ['more', ['activities', 'permits', 'local', 'other', 'reserve'], '#7c8a95', 'Entry, local & reserve', 'एंट्री, लोकल और रिज़र्व'],
];

export function groupTotals(b) {
  return COST_GROUPS.map(([k, cats, color, en, hi]) => ({
    k, color, en, hi, est: cats.reduce((s, c) => s + (b.lines[c]?.est || 0), 0), missing: cats.some((c) => b.lines[c]?.missing),
  }));
}

/** Dark "Trip cost · auto" card. b = computeBudget() result; null while dates/route are missing. */
export function LiveCost({ b, lang, onOpen, openLabel }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  if (!b) {
    return <div className="tp2-live"><h3>{L('Trip cost · auto', 'ट्रिप ख़र्च · अपने आप')}</h3><p className="tp2-live-empty">{L('Add the start, a destination and dates to see the cost.', 'ख़र्च देखने के लिए शुरुआत, मंज़िल और तारीख़ भरें।')}</p></div>;
  }
  const g = groupTotals(b);
  const sum = g.reduce((s, x) => s + x.est, 0) || 1;
  return (
    <div className="tp2-live" aria-live="polite">
      <h3>{L('Trip cost · auto', 'ट्रिप ख़र्च · अपने आप')} <span>{L('approx.', 'लगभग')}</span></h3>
      <div className="tp2-live-tot">{!b.total && b.missing.length ? '—' : inr(Math.round(b.total))}</div>
      <div className="tp2-live-sub"><span>{inr(Math.round(b.perPerson))} / {L('person', 'व्यक्ति')}</span><span>{inr(Math.round(b.perDay))} / {L('day', 'दिन')}</span><span>{b.people} {L('people', 'लोग')}</span></div>
      <div className="tp2-live-bar" aria-hidden="true">{g.map((x) => <i key={x.k} style={{ background: x.color, width: `${(x.est / sum) * 100}%` }} />)}</div>
      <div className="tp2-live-lines">
        {g.map((x) => (
          <div key={x.k} className="tp2-live-ln"><i style={{ background: x.color }} /><span>{L(x.en, x.hi)}</span>
            <b>{x.missing && !x.est ? <em>{L('add rate', 'रेट भरें')}</em> : inr(x.est)}</b></div>
        ))}
      </div>
      {b.missing.length ? <p className="tp2-live-warn">{L('Some rates are missing, so the real cost is higher.', 'कुछ रेट नहीं हैं, इसलिए असल ख़र्च ज़्यादा होगा।')}</p> : null}
      {onOpen ? <button type="button" className="btn btn-sm btn-block tp2-live-btn" onClick={onOpen}>{openLabel}</button> : null}
    </div>
  );
}

/** Sticky bottom bar on phones with the running total and the next step. */
export function LiveBar({ b, lang, next, onNext }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  return (
    <div className="tp2-livebar">
      <div><small>{L('Trip cost · auto', 'ट्रिप ख़र्च · अपने आप')}</small><b>{b && (b.total || !b.missing.length) ? inr(Math.round(b.total)) : '—'}</b></div>
      <button type="button" className="btn btn-sm" onClick={onNext}>{next} →</button>
    </div>
  );
}
