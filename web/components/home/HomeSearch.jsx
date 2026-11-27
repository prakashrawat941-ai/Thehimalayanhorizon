'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlaceSearch } from '@/components/PlaceSearch';
import { Icon } from '@/components/Icon';

const todayISO = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
// A place from PlaceSearch: a `places` row (use its id) or a destination/OSM result (use its position),
// matching how /cab/find reads ?from= / ?fromg=.
function putPlace(qs, key, p) {
  const isPlaceRow = p.id && p.location_id !== p.id && !p.ext;
  if (isPlaceRow) qs.set(key, p.id);
  else if (p.lat != null && p.lng != null) qs.set(`${key}g`, `${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)}|${String(p.name).slice(0, 120)}`);
}

function Stepper({ value, min, max, onChange, label, unit }) {
  return (
    <div className="rf-step" role="group" aria-label={label}>
      <Icon name="people" size={18}/>
      <button type="button" aria-label={`${label} −`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value} {unit(value)}</output>
      <button type="button" aria-label={`${label} +`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// One search card with three tabs. Each tab only asks for what its page can use today.
export function HomeSearch({ lang, labels, text }) {
  const router = useRouter();
  const [tab, setTab] = useState('stays');
  const [where, setWhere] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [guests, setGuests] = useState(2);
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState('');
  const T = (k) => text[k];

  function submit(e) {
    e.preventDefault();
    setError('');
    if (tab === 'stays') {
      const qs = new URLSearchParams();
      if (where?.district && !where.ext) qs.set('district', where.district);
      qs.set('guests', String(guests));
      if (checkIn || checkOut) {
        if (!checkIn || !checkOut || checkOut <= checkIn) {
          setError(L('Choose both stay dates. Check-out must be after check-in.', 'ठहरने की दोनों तारीखें चुनें। जाने की तारीख बाद में होनी चाहिए।'));
          return;
        }
        qs.set('check_in', checkIn);
        qs.set('check_out', checkOut);
      }
      router.push(`/homestays?${qs}`);
    } else if (tab === 'cab') {
      if (!from || !to) { setError(T('err_route')); return; }
      const qs = new URLSearchParams({ date, n: String(seats) });
      putPlace(qs, 'from', from); putPlace(qs, 'to', to);
      router.push(`/cab/find?${qs}`);
    } else {
      if (!where) { router.push('/plan'); return; }
      if (where.slug) router.push(`/plan?place=${encodeURIComponent(where.slug)}`);
      else if (where.lat != null) router.push(`/plan?${new URLSearchParams({ to: where.name, lat: String(where.lat), lng: String(where.lng) })}`);
      else router.push('/plan');
    }
  }

  const tabs = [['stays', 'house'], ['cab', 'car'], ['plan', 'route']];
  const pick = (setter) => (p) => { setter(p); setError(''); };
  return (
    <form className="rf-sc" role="search" onSubmit={submit}>
      <div className="rf-seg" role="tablist" aria-label={T('search_label')}>
        {tabs.map(([k, ic]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(''); }}>
            <Icon name={ic} size={17}/>{T(`tab_${k}`)}
          </button>
        ))}
      </div>
      <div className="rf-sf" role="tabpanel">
        {tab === 'stays' ? (<>
          <PlaceSearch key="stays" lang={lang} labels={labels} onPick={pick(setWhere)} onType={() => setWhere(null)} placeholder={T('where')} initial={where?.name || ''}/>
          <div className="rf-sf-row rf-stay-dates">
            <label className="field"><span className="field-label">{L('Check-in', 'आने की तारीख')}</span>
              <input className="input" type="date" min={todayISO()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)}/></label>
            <label className="field"><span className="field-label">{L('Check-out', 'जाने की तारीख')}</span>
              <input className="input" type="date" min={checkIn || todayISO()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)}/></label>
          </div>
          <Stepper value={guests} min={1} max={20} onChange={setGuests} label={T('guests')} unit={(n) => T(n === 1 ? 'guest' : 'guests_unit')}/>
        </>) : null}
        {tab === 'cab' ? (<>
          <PlaceSearch key="from" lang={lang} labels={labels} onPick={pick(setFrom)} onType={() => setFrom(null)} placeholder={T('from')} initial={from?.name || ''}/>
          <PlaceSearch key="to" lang={lang} labels={labels} onPick={pick(setTo)} onType={() => setTo(null)} placeholder={T('to')} initial={to?.name || ''}/>
          <div className="rf-sf-row">
            <label className="rf-in"><Icon name="calendar" size={18}/><span className="sr-only">{T('date')}</span>
              <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} aria-label={T('date')}/></label>
            <Stepper value={seats} min={1} max={10} onChange={setSeats} label={T('seats')} unit={(n) => T(n === 1 ? 'seat' : 'seats_unit')}/>
          </div>
        </>) : null}
        {tab === 'plan' ? (
          <PlaceSearch key="plan" lang={lang} labels={labels} onPick={pick(setWhere)} onType={() => setWhere(null)} placeholder={T('plan_where')} initial={where?.name || ''}/>
        ) : null}
        {error ? <p className="rf-err" role="alert">{error}</p> : null}
        <button className="btn rf-go" type="submit">{T(`go_${tab}`)}<Icon name="arrow" size={16}/></button>
      </div>
    </form>
  );
}
