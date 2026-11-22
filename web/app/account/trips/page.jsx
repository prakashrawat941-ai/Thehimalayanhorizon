import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { fmtDate, inr } from '@/lib/format';
import { Empty } from '@/components/Blocks';
import { Icon } from '@/components/Icon';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('my_trips') };
}

const STATUS = { draft: ['Draft', 'ड्राफ़्ट'], planning: ['Planning', 'प्लानिंग'], ready: ['Ready', 'तैयार'], upcoming: ['Upcoming', 'आने वाली'], ongoing: ['On the way', 'चल रही'], completed: ['Completed', 'पूरी'], cancelled: ['Cancelled', 'रद्द'] };
const CLS = { draft: 'draft', planning: 'pending', ready: 'approved', upcoming: 'confirmed', ongoing: 'confirmed', completed: 'completed', cancelled: 'cancelled' };

export default async function Trips() {
  const { db, user } = await requireUser('/account/trips');
  const { t, L, lang } = await getT();
  const list = await rows(db.from('trips').select('id,title,status,start_date,end_date,days_count,adults,children,travellers,budget,share_token,updated_at')
    .eq('user_id', user.id).order('updated_at', { ascending: false }));
  return (
    <>
      <div className="ds-head"><div className="grow"><h1>{t('my_trips')}</h1>
        <p className="muted">{L('Trips you planned with the Trip Planner. Open a trip to see its report, share it or edit it.', 'ट्रिप प्लानर से बनाई आपकी यात्राएँ। ट्रिप खोलकर रिपोर्ट देखें, शेयर करें या बदलें।')}</p></div>
        <div className="ds-actions"><Link className="btn" href="/plan"><Icon name="plus" size={16} /> {t('new_trip')}</Link></div>
      </div>
      {list.length ? (
        <div className="ds-body">
          {list.map((x) => {
            const s = STATUS[x.status] || [x.status, x.status];
            const people = (x.adults || 0) + (x.children || 0) || x.travellers;
            return (
              <article key={x.id} className="ds-panel">
                <div className="ds-row" style={{ borderTop: 0, padding: 0 }}>
                  <span className="ds-row-ico"><Icon name="map" /></span>
                  <span className="grow"><strong>{x.title}</strong>
                    <span>{[x.start_date ? fmtDate(x.start_date, lang) : L('No date yet', 'तारीख़ नहीं'), x.days_count ? `${x.days_count} ${t('days')}` : null, people ? `${people} ${t('guests')}` : null, x.budget ? `${inr(x.budget)} (${t('approx')})` : null].filter(Boolean).join(' · ')}</span></span>
                  <span className={`badge badge-${CLS[x.status] || 'draft'}`}>{lang === 'hi' ? s[1] : s[0]}</span>
                </div>
                <div className="row-actions">
                  <Link className="btn btn-sm" href={`/trip/${x.id}`}>{L('Open', 'खोलें')}</Link>
                  {x.share_token ? <Link className="btn btn-ghost btn-sm" href={`/t/${x.share_token}`}>{L('Shared link', 'शेयर लिंक')}</Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty icon="map" text={L('No trips yet.', 'अभी कोई यात्रा नहीं।')} action={<Link className="btn" href="/plan">{t('new_trip')}</Link>} />}
    </>
  );
}
