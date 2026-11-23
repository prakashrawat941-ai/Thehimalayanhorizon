import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requirePartner, loadHost } from '@/lib/partner';
import { rows } from '@/lib/account';
import { Empty } from '@/components/Blocks';
import { RateCalendar } from '@/components/partner/RateCalendar';

export default async function Calendar({ searchParams }) {
  const sp = await searchParams;
  const { db, partner } = await requirePartner('/partner/calendar');
  const { L, lang } = await getT();
  const { hs, rooms } = await loadHost(db, partner);
  const active = rooms.filter((r) => r.is_active);
  const room = active.find((r) => r.id === sp.room) || active[0];
  const month = /^\d{4}-\d{2}$/.test(sp.month || '') ? sp.month : new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
  if (!room) return <Empty icon="calendar" text={L('Add a property with rooms first.', 'पहले कमरों वाली प्रॉपर्टी जोड़ें।')} action={<Link className="btn" href="/partner/properties/new">{L('Add property', 'प्रॉपर्टी जोड़ें')}</Link>} />;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rates = await rows(db.from('room_rates').select('*').eq('room_id', room.id).gte('date', `${month}-01`).lte('date', `${month}-${String(last).padStart(2, '0')}`));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{L('Rate calendar', 'रेट कैलेंडर')}</h1>
        <p className="muted">{L('Set a special price or block rooms for any date. Empty dates use the weekend (Fri, Sat nights) or base price.', 'किसी भी तारीख़ का ख़ास किराया रखें या कमरे बंद करें। ख़ाली तारीख़ों पर वीकेंड (शुक्र, शनि की रात) या बेस किराया लगेगा।')}</p></div></div>
      <div className="seg-tabs">{active.map((r) => {
        const h = hs.find((x) => x.id === r.homestay_id);
        return <Link key={r.id} className={r.id === room.id ? 'on' : ''} href={`/partner/calendar?room=${r.id}&month=${month}`}>{h?.name} · {r.room_type}</Link>;
      })}</div>
      <RateCalendar lang={lang} room={room} month={month} rates={rates} />
    </>
  );
}
