import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows, nights } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { Cover } from '@/components/Cover';
import { CancelBooking } from '@/components/account/CancelBooking';
import { splitHouseRules } from '@/lib/stay';

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
    .select('*, homestays(name, village, district, images, house_rules), village_tours(title, images), workspaces(name, images), homestay_rooms(room_type)')
    .eq('user_id', user.id).order('start_date', { ascending: false }));
  const groups = {
    active: all.filter((b) => ['requested', 'confirmed', 'checked_in'].includes(b.status)),
    past: all.filter((b) => b.status === 'completed'),
    cancelled: all.filter((b) => ['declined', 'cancelled'].includes(b.status)),
  };
  const labels = { active: L('Upcoming & requests', 'आने वाली और रिक्वेस्ट'), past: L('Completed', 'पूरी हुईं'), cancelled: L('Cancelled / declined', 'रद्द / मना') };
  const list = groups[tab];
  const name = (b) => b.homestays?.name || b.village_tours?.title || b.workspaces?.name || b.kind;

  const img = (b) => (b.homestays?.images || b.village_tours?.images || b.workspaces?.images || [])[0];
  const where = (b) => [b.homestays?.village, b.homestays?.district].filter(Boolean).join(' · ');
  // Status line: homestays have a check-in step; tours and workspaces go straight from confirmed to completed.
  const timeline = (b) => {
    const steps = b.kind === 'homestay' ? ['requested', 'confirmed', 'checked_in', 'completed'] : ['requested', 'confirmed', 'completed'];
    const label = { requested: L('Requested', 'रिक्वेस्ट'), confirmed: L('Confirmed', 'कन्फर्म'), checked_in: L('Checked in', 'चेक-इन'), completed: L('Completed', 'पूरा') };
    if (['declined', 'cancelled'].includes(b.status)) {
      return <ol className="ac-tl" aria-label={tr.status(b.status)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        <li className="done"><i>✓</i>{label.requested}</li><li className="stop"><i>✕</i>{tr.status(b.status)}</li>{steps.slice(2).map((s) => <li key={s}><i /></li>)}</ol>;
    }
    const at = b.status === 'completed' ? steps.length : steps.indexOf(b.status);
    return <ol className="ac-tl" aria-label={tr.status(b.status)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}><i>{i < at ? '✓' : i === at ? '•' : ''}</i>{label[s]}</li>)}</ol>;
  };
  const tone = { requested: 'requested', confirmed: 'confirmed', checked_in: 'confirmed', completed: 'full', declined: 'declined', cancelled: 'cancelled' };

  return (
    <>
      <div className="ac-head"><div><h1>{L('Stays & tours', 'होमस्टे और टूर')}</h1>
        <p>{L('No online payment — you pay the host directly as agreed.', 'कोई ऑनलाइन पेमेंट नहीं — तय अनुसार सीधे होस्ट को भुगतान।')}</p></div></div>
      {sp.sent ? <p className="soft-note ok" role="status">{L('Request sent. The host will confirm or decline; you will get a notification.', 'रिक्वेस्ट भेज दी। होस्ट कन्फर्म या मना करेंगे; आपको सूचना मिलेगी।')}</p> : null}
      <div className="seg-tabs" role="navigation" aria-label={L('Booking filter', 'बुकिंग फ़िल्टर')}>
        {TABS.map((k) => (
          <Link key={k} aria-current={tab === k ? 'page' : undefined} className={tab === k ? 'on' : ''} href={`/account/bookings?tab=${k}`} scroll={false}>
            {labels[k]} ({groups[k].length})
          </Link>
        ))}
      </div>
      {list.length ? (
        <div className="ac-list">
          {list.map((b) => {
            const rule = b.kind === 'homestay' ? splitHouseRules(b.homestays?.house_rules).cancellation : '';
            return (
              <article key={b.id} className="ac-bk">
                <div className="ac-bk-top">
                  <Cover url={img(b)} seed={b.homestay_id || b.village_tour_id || b.workspace_id || b.id} className="ac-bk-img" />
                  <span>
                    <span className={`badge badge-${tone[b.status] || b.status}`}>{tr.status(b.status)}</span>
                    <b>{name(b)}</b>
                    {where(b) ? <small>{where(b)}</small> : null}
                    {b.booking_code ? <small className="mono">{b.booking_code}</small> : null}
                  </span>
                </div>
                {timeline(b)}
                <dl className="ac-dl">
                  <div><dt>{t('date')}</dt><dd>{fmtDate(b.start_date, lang)}{b.end_date && b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)}` : ''}{b.kind === 'homestay' && b.end_date ? ` · ${nights(b.start_date, b.end_date)} ${L('night(s)', 'रात')}` : ''}</dd></div>
                  {b.homestay_rooms?.room_type ? <div><dt>{L('Room', 'कमरा')}</dt><dd>{b.rooms_booked || 1} × {b.homestay_rooms.room_type}</dd></div> : null}
                  <div><dt>{t('guests')}</dt><dd>{b.guests}</dd></div>
                  {b.total_amount != null ? <div><dt>{b.status === 'requested' ? L('Estimate', 'अनुमान') : L('Amount', 'रकम')}</dt><dd>{inr(b.total_amount)}</dd></div> : null}
                </dl>
                {b.partner_note ? <p className={`ac-hnote${b.status === 'declined' ? ' bad' : ''}`}><strong>{L('Host', 'होस्ट')}:</strong> {b.partner_note}</p> : null}
                {b.status === 'requested' ? <p className="ac-wait">{L("Waiting for the host. You'll get a notification when they reply. The host confirms the final amount.", 'होस्ट का इंतज़ार। जवाब आने पर आपको सूचना मिलेगी। अंतिम रकम होस्ट कन्फर्म करेंगे।')}</p> : null}
                <div className="ac-acts">
                  {b.kind === 'homestay' && ['confirmed', 'checked_in', 'completed'].includes(b.status)
                    ? <Link className="btn btn-sm" href={`/account/bookings/${b.id}`}><Icon name="doc" size={16} /> {L('Voucher', 'वाउचर')}</Link> : null}
                  {['requested', 'confirmed'].includes(b.status) ? (
                    <CancelBooking id={b.id} lang={lang} rule={rule} label={b.status === 'requested' ? L('Cancel request', 'रिक्वेस्ट रद्द करें') : t('cancel')}
                      title={L('Cancel this booking?', 'यह बुकिंग रद्द करें?')} summary={`${name(b)} · ${fmtDate(b.start_date, lang)}${b.end_date && b.end_date !== b.start_date ? ` → ${fmtDate(b.end_date, lang)}` : ''}`} />
                  ) : null}
                  {['declined', 'cancelled'].includes(b.status) && b.kind === 'homestay' ? <Link className="btn btn-ghost btn-sm" href="/homestays">{L('Find another homestay', 'दूसरा होमस्टे खोजें')}</Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="ac-state"><Icon name="house" size={30} /><h2>{tab === 'active' ? L('No bookings yet', 'अभी कोई बुकिंग नहीं') : L('Nothing here yet', 'यहाँ अभी कुछ नहीं')}</h2>
          <p>{L('When you send a homestay request it shows up here with its status.', 'होमस्टे रिक्वेस्ट भेजने पर वह अपनी स्थिति के साथ यहाँ दिखेगी।')}</p>
          <Link className="btn" href="/homestays">{L('Browse homestays', 'होमस्टे देखें')}</Link></div>
      )}
    </>
  );
}
