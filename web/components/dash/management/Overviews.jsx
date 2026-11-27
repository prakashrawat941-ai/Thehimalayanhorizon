'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Kpi, KpiRow, ListRow, Panel, Tag } from '../parts';
import { DashEmpty, DashNotConnected } from '../DashStates';
import { Icon } from '@/components/Icon';
import { rupees, tr } from './ui';

const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

/** Founder overview KPIs. finance = management_finance() row; counts from the server. null = not connected. */
export function FounderOverview({ lang, finance, waiting, mfaReady, teamSize, children }) {
  const L = tr(lang);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Founder', 'संस्थापक')}</p><h1>{L('Overview', 'ओवरव्यू')}</h1>
        <p className="muted">{L('Amounts are booking records — payments happen outside the platform.', 'रकम बुकिंग के रिकॉर्ड हैं — भुगतान प्लेटफ़ॉर्म के बाहर होता है।')}</p></div></div>
      <KpiRow>
        <Kpi label={L('Homestay booking value (records)', 'होमस्टे बुकिंग मूल्य (रिकॉर्ड)')} value={finance ? rupees(finance.booking_value) : '—'} />
        <Kpi label={L('Commission (records)', 'कमीशन (रिकॉर्ड)')} value={finance ? rupees(finance.commission) : '—'} />
        <Kpi label={L('Waiting for you', 'आपका इंतज़ार')} value={n(waiting)} hint={waiting == null ? L('Not connected yet', 'अभी जुड़ा नहीं') : L('critical · finance · expense', 'महत्वपूर्ण · वित्त · खर्च')} href="/founder/approvals" />
        <Kpi label={L('Team with two-step', 'दो-चरण वाली टीम')} value={mfaReady == null ? '—' : `${mfaReady} / ${teamSize}`} hint={mfaReady == null ? L('Not connected yet', 'अभी जुड़ा नहीं') : null} href="/founder/access" />
      </KpiRow>
      {children}
    </>
  );
}

/**
 * CEO "Operations today". counts: { checkins, rides, holds, sos } from existing tables (IST day).
 * alerts: [{ id, icon, tone, title, sub, href, action }]. offices: [{ id, name, status, sub }].
 */
export function OpsToday({ lang, counts, alerts, offices, officesConnected = true }) {
  const L = tr(lang);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Operations today', 'आज का संचालन')}</h1>
        <p className="muted">{L('Live from bookings and rides. Times in IST.', 'बुकिंग और राइड से लाइव। समय IST में।')}</p></div></div>
      <KpiRow>
        <Kpi label={L('Homestay check-ins', 'होमस्टे चेक-इन')} value={n(counts?.checkins)}  />
        <Kpi label={L('Cab rides today', 'आज की कैब राइड')} value={n(counts?.rides)}  />
        <Kpi label={L('Seat holds now', 'अभी सीट होल्ड')} value={n(counts?.holds)}  />
        <Kpi label={L('Open SOS', 'खुले SOS')} value={n(counts?.sos)}  />
      </KpiRow>
      <div className="dsx-grid2">
        <Panel title={L('Needs action', 'कार्रवाई ज़रूरी')} count={alerts.length}>
          {alerts.length ? alerts.map((a) => (
            <ListRow key={a.id} icon={a.icon} tone={a.tone} title={a.title} sub={a.sub}>
              {a.href ? <Link className="btn btn-ghost btn-sm" href={a.href}>{a.action || L('Open', 'खोलें')}</Link> : null}
            </ListRow>
          )) : <p className="dsx-note">{L('Nothing needs action right now.', 'अभी कुछ करने को नहीं।')}</p>}
        </Panel>
        <Panel title={L('Village offices', 'ग्राम कार्यालय')}>
          {!officesConnected ? <p className="dsx-note">{L('Not connected yet.', 'अभी जुड़ा नहीं।')}</p>
            : offices.length ? offices.map((o) => <ListRow key={o.id} icon="pin" tone={o.status === 'in' ? 'green' : 'gray'} title={o.name} sub={o.sub} />)
              : <p className="dsx-note">{L('No village offices added yet.', 'अभी कोई ग्राम कार्यालय नहीं।')}</p>}
        </Panel>
      </div>
    </>
  );
}

/** Co-founder: homepage sections from home_sections. sections: [{ id, title, enabled, position, note }] */
export function CmsSections({ lang, sections, editHref = '/admin/cms' }) {
  const L = tr(lang);
  if (!sections.length) return <DashEmpty title={L('No homepage sections', 'होमपेज के कोई सेक्शन नहीं')} text={L('Add sections in the content editor.', 'कंटेंट एडिटर में सेक्शन जोड़ें।')} />;
  return (
    <Panel title={L('Homepage sections', 'होमपेज सेक्शन')} action={<Link className="btn btn-ghost btn-sm" href={editHref}>{L('Edit', 'बदलें')}</Link>}>
      {sections.map((s) => (
        <ListRow key={s.id} icon="globe" tone="violet" title={s.title} sub={[L(`Position ${s.position}`, `स्थान ${s.position}`), s.note].filter(Boolean).join(' · ')}>
          <Tag tone={s.enabled ? 'green' : 'gray'}>{s.enabled ? L('Live', 'लाइव') : L('Hidden', 'छिपा')}</Tag>
        </ListRow>
      ))}
    </Panel>
  );
}

const STEPS = [['basic', 'Basic info', 'बुनियादी जानकारी'], ['rooms', 'Rooms', 'कमरे'], ['photos', 'Photos', 'फ़ोटो'], ['policies', 'Policies', 'नियम'], ['kyc', 'KYC', 'KYC'], ['review', 'Review', 'जाँच']];

/**
 * Co-founder homestay onboarding. partners: [{ id, name, sub, done: ['basic','rooms',...], href }]
 * Step completion is derived on the server from partners / homestays / homestay_rooms / partner_kyc.
 */
export function OnboardingQueue({ lang, partners, connected = true, sendAction = null }) {
  const L = tr(lang);
  if (!connected) return <DashNotConnected title={L('Not connected yet', 'अभी जुड़ा नहीं')} />;
  if (!partners.length) return <DashEmpty title={L('No partners waiting', 'कोई पार्टनर इंतज़ार में नहीं')} text={L('New homestay registrations will appear here.', 'नए होमस्टे रजिस्ट्रेशन यहाँ दिखेंगे।')} />;
  return (
    <Panel title={L('Homestay onboarding', 'होमस्टे ऑनबोर्डिंग')} count={partners.length}>
      {partners.map((p) => {
        const done = STEPS.filter(([k]) => p.done?.includes(k));
        const next = STEPS.find(([k]) => !p.done?.includes(k));
        const ready = !next;
        return (
          <div key={p.id} className="dsx-row">
            <span className="dsx-row-ic dsx-t-violet"><Icon name="house" size={18} /></span>
            <span className="dsx-row-tx"><b>{p.name}</b>
              <small>{[p.sub, L(`${done.length} of ${STEPS.length} steps`, `${STEPS.length} में से ${done.length} चरण`), next ? L(`Next: ${next[1]}`, `अगला: ${next[2]}`) : null].filter(Boolean).join(' · ')}</small>
              <span className="dsx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={done.length}><i style={{ width: `${(done.length / STEPS.length) * 100}%` }} /></span>
            </span>
            <span className="dsx-row-act">
              {next?.[0] === 'review' && p.listingId && sendAction
                ? <SendHomestay id={p.listingId} action={sendAction} L={L} />
                : p.href ? <Link className="btn btn-ghost btn-sm" href={p.href}>{ready ? L('Open in Approvals', 'मंज़ूरी में खोलें') : L('Help finish', 'पूरा करने में मदद')}</Link> : null}
            </span>
          </div>
        );
      })}
      <p className="dsx-note">{L('Admin sets commission and gives final approval.', 'कमीशन और अंतिम मंज़ूरी एडमिन देते हैं।')}</p>
    </Panel>
  );
}

function SendHomestay({ id, action, L }) {
  const [busy, start] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();
  return <><button type="button" className="btn btn-sm" disabled={busy} onClick={() => start(async () => {
    const form = new FormData(); form.set('homestay_id', id);
    try {
      const result = await action(form);
      setMessage(result.ok ? L('Sent for approval.', 'मंज़ूरी के लिए भेजा।') : result.message);
      if (result.ok) router.refresh();
    } catch { setMessage(L('Could not send. Try again.', 'भेज नहीं सके। फिर कोशिश करें।')); }
  })}>{L('Send for approval', 'मंज़ूरी के लिए भेजें')}</button>{message ? <small role="status">{message}</small> : null}</>;
}
