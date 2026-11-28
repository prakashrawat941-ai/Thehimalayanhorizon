import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { rows } from '@/lib/account';
import { inr } from '@/lib/format';
import { Decide, PrivateFile } from '@/components/admin/Decide';
import { homestayPublicationIssues } from '@/lib/publication';

const TABS = ['partners', 'homestays', 'tours', 'workspaces', 'kyc'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

export default async function Approvals({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab) ? sp.tab : 'partners';
  const { db } = await requireAdmin('/admin/approvals');
  const { L, lang } = await getT();
  const [partners, homestays, tours, works, kyc, rooms] = await Promise.all([
    rows(db.from('partners').select('*').eq('status', 'pending').order('created_at')),
    rows(db.from('homestays').select('*, partners(business_name, contact_name)').eq('status', 'pending').order('updated_at')),
    rows(db.from('village_tours').select('*, partners(business_name)').eq('status', 'pending').order('updated_at')),
    rows(db.from('workspaces').select('*, partners(business_name)').eq('status', 'pending').order('updated_at')),
    rows(db.from('partner_kyc').select('*, partners(business_name, contact_name)').eq('status', 'pending').order('updated_at')),
    rows(db.from('homestay_rooms').select('homestay_id, room_type, total_inventory, base_price, weekend_price').eq('is_active', true)),
  ]);
  const counts = { partners: partners.length, homestays: homestays.length, tours: tours.length, workspaces: works.length, kyc: kyc.length };
  const labels = { partners: L('Partners', 'पार्टनर'), homestays: L('Homestays', 'होमस्टे'), tours: L('Village tours', 'गाँव के टूर'), workspaces: L('Workspaces', 'वर्कस्पेस'), kyc: 'KYC' };
  const empty = <p className="muted">{L('Nothing waiting.', 'कुछ बाकी नहीं।')}</p>;
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Approvals', 'मंज़ूरी')}</h1><p className="muted">{L('Rejections need a written remark; the partner sees it.', 'मना करने पर लिखित टिप्पणी ज़रूरी; पार्टनर उसे देखेंगे।')}</p></div></div>
      <div className="seg-tabs">{TABS.map((k) => <Link key={k} className={tab === k ? 'on' : ''} href={`/admin/approvals?tab=${k}`}>{labels[k]} ({counts[k]})</Link>)}</div>
      <div className="ds-body">
        {tab === 'partners' ? (partners.length ? partners.map((p) => (
          <article key={p.id} className="ds-panel"><h2>{p.business_name}</h2>
            <p className="small">{p.contact_name} · {p.phone}{p.email ? ` · ${p.email}` : ''} · {(p.categories || []).join(', ')} · {p.village || ''}</p>
            {p.about ? <p className="small muted">{p.about}</p> : null}
            <Decide lang={lang} table="partners" id={p.id} />
          </article>)) : empty) : null}

        {tab === 'homestays' ? (homestays.length ? homestays.map((h) => {
          const issues = homestayPublicationIssues(h);
          return (
          <article key={h.id} className="ds-panel"><h2>{h.name}</h2>
            <p className="small">{h.partners?.business_name} · {[h.village, h.district, h.state].filter(Boolean).join(', ')} · {(h.images || []).length} {L('photos', 'फ़ोटो')}</p>
            <p className="small muted">{h.summary}</p>
            <p className="small">{rooms.filter((r) => r.homestay_id === h.id).map((r) => `${r.room_type} × ${r.total_inventory} (${inr(r.base_price)}${r.weekend_price ? ` / ${inr(r.weekend_price)}` : ''})`).join(' · ')}</p>
            {(h.images || []).length ? <div className="gallery-grid">{h.images.slice(0, 4).map((u) => <img key={u} src={u} alt="" loading="lazy" />)}</div> : null}
            {issues.length ? <p className="soft-note warn" role="status">{L('Complete before approval:', 'मंज़ूरी से पहले पूरा करें:')} {issues.map((issue) => issue[lang === 'hi' ? 1 : 0]).join(', ')}</p> : null}
            <Decide lang={lang} table="homestays" id={h.id} commission={h.commission_rate ?? 12} canApprove={!issues.length} />
          </article>);
        }) : empty) : null}

        {tab === 'tours' ? (tours.length ? tours.map((x) => (
          <article key={x.id} className="ds-panel"><h2>{x.title}</h2><p className="small">{x.partners?.business_name} · {x.village} · {inr(x.price_per_person)}</p><p className="small muted">{x.summary}</p>
            <Decide lang={lang} table="village_tours" id={x.id} /></article>)) : empty) : null}

        {tab === 'workspaces' ? (works.length ? works.map((x) => (
          <article key={x.id} className="ds-panel"><h2>{x.name}</h2><p className="small">{x.partners?.business_name} · {x.village} · {inr(x.price_per_day)}/{L('day', 'दिन')} · {x.wifi_mbps ? `${x.wifi_mbps} Mbps` : ''}</p><p className="small muted">{x.summary}</p>
            <Decide lang={lang} table="workspaces" id={x.id} /></article>)) : empty) : null}

        {tab === 'kyc' ? (kyc.length ? kyc.map((k) => {
          const mismatch = k.bank_account_name && k.partners?.contact_name && norm(k.bank_account_name) !== norm(k.partners.contact_name) && !norm(k.bank_account_name).includes(norm(k.partners.contact_name).slice(0, 5));
          return (
            <article key={k.partner_id} className="ds-panel"><h2>{k.partners?.business_name}</h2>
              <dl className="kv-rows">
                <div className="kv-row"><dt>{L('ID', 'आईडी')}</dt><dd>{k.id_type} · {k.id_number}</dd></div>
                {k.gst_number ? <div className="kv-row"><dt>PAN / GST</dt><dd>{k.gst_number}</dd></div> : null}
                <div className="kv-row"><dt>{L('Payout to', 'पेआउट')}</dt><dd>{k.upi_id ? `UPI ${k.upi_id}` : ''}{k.bank_account_number ? ` · ${k.bank_account_name || ''} · ${k.bank_account_number} · ${k.bank_ifsc}` : ''}</dd></div>
              </dl>
              {mismatch ? <p className="soft-note warn">{L(`Name check: bank name "${k.bank_account_name}" differs from partner name "${k.partners.contact_name}".`, `नाम जाँच: बैंक का नाम "${k.bank_account_name}" पार्टनर के नाम "${k.partners.contact_name}" से अलग है।`)}</p> : null}
              <PrivateFile bucket="partner-docs" path={k.id_file} label={L('View ID file (5-minute link)', 'आईडी फ़ाइल देखें (5 मिनट का लिंक)')} />
              <Decide lang={lang} table="partner_kyc" idField="partner_id" id={k.partner_id} approve="verified" remarkField="admin_remark" />
            </article>
          );
        }) : empty) : null}
      </div>
    </>
  );
}
