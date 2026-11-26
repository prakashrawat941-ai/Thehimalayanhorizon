import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { Empty } from '@/components/Blocks';
import { MarkRead } from '@/components/account/MarkRead';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('notifications') };
}

// Old links in the database look like "#/cab/bookings"; turn them into new-site paths where they exist.
const MAP = { 'admin/safety': '/admin/cab?tab=sos', 'cab/bookings': '/account/cab', account: '/account', trips: '/account/trips', 'account/bookings': '/account/bookings' };
function href(link) {
  if (!link) return null;
  if (link.startsWith('#/')) { const p = link.slice(2); return MAP[p] || `/${link}`; }
  return /^\/(?![\/\\])/.test(link) && !/[\\\u0000-\u001f]/.test(link) ? link : null;
}

export default async function Notifications() {
  const { db, user } = await requireUser('/account/notifications');
  const { t, L, lang } = await getT();
  const list = await rows(db.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50));
  const unread = list.filter((n) => !n.read_at).map((n) => n.id);
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{t('notifications')}</h1>
        <p className="muted">{L('In-app messages about your bookings and rides.', 'आपकी बुकिंग और राइड के बारे में ऐप के अंदर के संदेश।')}</p></div></div>
      <MarkRead ids={unread} />
      {list.length ? (
        <section className="ds-panel">
          <div className="ds-rows">
            {list.map((n) => {
              const inner = (
                <>
                  <span className="grow"><strong>{n.title}</strong><span>{n.body}</span><span>{when(n.created_at)}</span></span>
                  {!n.read_at ? <span className="badge badge-new">{L('New', 'नया')}</span> : null}
                </>
              );
              const h = href(n.link);
              return h ? <a key={n.id} className="ds-row" href={h}>{inner}</a> : <div key={n.id} className="ds-row">{inner}</div>;
            })}
          </div>
        </section>
      ) : <Empty icon="bell" text={L('No notifications yet.', 'अभी कोई सूचना नहीं।')} />}
    </>
  );
}
