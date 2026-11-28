import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { Icon } from '@/components/Icon';
import { MarkRead } from '@/components/account/MarkRead';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('notifications') };
}

// Old links in the database look like "#/cab/bookings"; turn them into new-site paths where they exist.
const MAP = { 'admin/safety': '/admin/cab?tab=sos', 'cab/bookings': '/account/cab', account: '/account', trips: '/account/trips', 'account/bookings': '/account/bookings' };
function href(link) {
  if (!link) return null;
  if (link.startsWith('#/')) { const p = link.slice(2); return MAP[p] || `https://thehimalayanhorizon.netlify.app/${link}`; }
  return link;
}

export default async function Notifications() {
  const { db, user } = await requireUser('/account/notifications');
  const { t, L, lang } = await getT();
  const list = await rows(db.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50));
  const unread = list.filter((n) => !n.read_at).map((n) => n.id);
  const when = (iso) => new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const todayKey = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const dayKey = (iso) => new Date(new Date(iso).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const groups = [[L('Today', 'आज'), list.filter((n) => dayKey(n.created_at) === todayKey)], [L('Earlier', 'पहले'), list.filter((n) => dayKey(n.created_at) !== todayKey)]].filter(([, g]) => g.length);
  return (
    <>
      <div className="ac-head"><div><h1>{t('notifications')}</h1>
        <p>{L('Messages about your bookings and rides. New ones are marked read after you open this page.', 'आपकी बुकिंग और राइड के संदेश। यह पेज खोलने के बाद नए संदेश पढ़े हुए मान लिए जाते हैं।')}</p></div></div>
      <MarkRead ids={unread} />
      {list.length ? groups.map(([label, g]) => (
        <section key={label}>
          <p className="ac-ng">{label}</p>
          {g.map((n) => {
            const inner = (
              <>
                <span className="ac-ic"><Icon name="bell" size={18} /></span>
                <span className="ac-tx"><b>{n.title}</b>{n.body ? <small>{n.body}</small> : null}<small>{when(n.created_at)}</small></span>
                {!n.read_at ? <span className="ac-dot" aria-label={L('New', 'नया')} /> : null}
              </>
            );
            const h = href(n.link);
            return h ? <a key={n.id} className={`ac-nt${n.read_at ? '' : ' new'}`} href={h}>{inner}</a> : <div key={n.id} className={`ac-nt${n.read_at ? '' : ' new'}`}>{inner}</div>;
          })}
        </section>
      )) : <div className="ac-state"><Icon name="bell" size={30} /><h2>{L('No notifications yet', 'अभी कोई सूचना नहीं')}</h2><p>{L('Booking and ride updates will show up here.', 'बुकिंग और राइड की ख़बरें यहाँ दिखेंगी।')}</p></div>}
    </>
  );
}
