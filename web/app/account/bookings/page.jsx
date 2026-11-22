import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { Empty } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { RpcButton } from '@/components/account/RpcButton';

export async function generateMetadata() {
  const { L } = await getT();
  return { title: L('My bookings', 'मेरी बुकिंग') };
}

const TABS = ['active', 'past', 'cancelled'];

export default async function Bookings({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab) ? sp.tab : 'active';
  const { db, user } = await requireUser('/account/bookings');
  const tr = await getT();
  const { t, L, lang } = tr;
  const all = await rows(db.from('booking_requests')
    .select('*, homestays(name, village, district), village_tours(title), workspaces(name), homestay_rooms(room_type)')
    .eq('user_id', user.id).order('start_date', { ascending: false }));
  const groups = {
    active: all.filter((b) => ['requested', 'confirmed', 'checked_in'].includes(b.status)),
    past: all.filter((b) => b.status === 'completed'),
    cancelled: all.filter((b) => ['declined', 'cancelled'].includes(b.status)),
  };
  const labels = { active: L('Upcoming & requests', 'आने वाली और रिक्वेस्ट'), past: L('Completed', 'पूरी हुईं'), cancelled: L('Cancelled / declined', 'रद्द / मना') };
  const list = groups[tab];
  const name = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || b.kind;

  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Stays & tours', 'होमस्टे और टूर')}</h1>
        <p className="muted">{L('No online payment: you pay the host directly as agreed.', 'कोई ऑनलाइन पेमेंट नहीं: तय अनुसार सीधे होस्ट को भुगतान।')}</p></div></div>
      <div className="seg-tabs" role="tablist">
        {TABS.map((k) => (
          <Link key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} href={`/account/bookings?tab=${k}`} scroll={false}>
            {labels[k]} ({groups[k].length})
          </Link>
        ))}
      </div>
      {list.length ? (
        <div className="ds-body">
          {list.map((b) => (
            <article key={b.id} className="ds-panel">
              <div className="ds-row" style={{ borderTop: 0, padding: 0 }}>
                <span className="ds-row-ico"><Icon name={b.kind === 'homestay' ? 'house' : b.kind === 'workspace' ? 'desk' : 'people'} /></span>
                <span className="grow">
                  <strong>{name(b)}</strong>
                  <span>{[b.homestays?.village, b.homestays?.district].filter(Boolean).join(', ')}</span>
                </span>
                <span className={`badge badge-${b.status}`}>{tr.status(b.status)}</span>
              </div>
              <dl className="kv-rows">
                {b.booking_code ? <div className="kv-row"><dt>{L('Booking ID', 'बुकिंग आईडी')}</dt><dd className="mono">{b.booking_code}</dd></div> : null}
                <div className="kv-row"><dt>{t('date')}</dt><dd>{fmtDate(b.start_date, lang)}{b.end_date && b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)}` : ''}{b.kind === 'homestay' && b.end_date ? ` · ${nights(b.start_date, b.end_date)} ${L('night(s)', 'रात')}` : ''}</dd></div>
                {b.homestay_rooms?.room_type ? <div className="kv-row"><dt>{L('Room', 'कमरा')}</dt><dd>{b.homestay_rooms.room_type} × {b.rooms_booked || 1}</dd></div> : null}
                <div className="kv-row"><dt>{t('guests')}</dt><dd>{b.guests}</dd></div>
                {b.total_amount != null ? (
                  <div className="kv-row"><dt>{b.status === 'requested' ? L('Estimate', 'अनुमान') : L('Amount', 'रकम')}</dt>
                    <dd><strong>{inr(b.total_amount)}</strong>{b.status === 'requested' ? <small className="muted"> · {L('host confirms the final amount', 'अंतिम रकम होस्ट कन्फर्म करेंगे')}</small> : null}</dd></div>
                ) : null}
                {b.partner_note ? <div className="kv-row"><dt>{L('Host note', 'होस्ट का नोट')}</dt><dd>{b.partner_note}</dd></div> : null}
              </dl>
              <div className="row-actions">
                {b.kind === 'homestay' && ['confirmed', 'checked_in', 'completed'].includes(b.status)
                  ? <Link className="btn btn-sm" href={`/account/bookings/${b.id}`}><Icon name="doc" size={16} /> {L('Voucher', 'वाउचर')}</Link> : null}
                {['requested', 'confirmed'].includes(b.status) ? (
                  <RpcButton fn="set_booking_status" args={{ p_id: b.id, p_status: 'cancelled', p_note: '' }} label={t('cancel')}
                    confirmText={L('Cancel this booking?', 'यह बुकिंग रद्द करें?')} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : <Empty icon="house" text={L('Nothing here yet.', 'यहाँ अभी कुछ नहीं।')} action={<Link className="btn btn-ghost" href="/homestays">{t('stays')}</Link>} />}
    </>
  );
}
