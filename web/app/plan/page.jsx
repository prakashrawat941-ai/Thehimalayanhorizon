import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getItineraries } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { Grid, ItineraryCard, PageHead } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { DraftResume } from '@/components/trip/DraftResume';

export async function generateMetadata() {
  const { t, L } = await getT();
  return { title: t('nav_planner'), description: L('Plan an Uttarakhand road trip: real road route, weather, day-wise plan and budget.', 'उत्तराखंड यात्रा प्लान करें: असली सड़क रास्ता, मौसम, दिन-वार प्लान और बजट।'), alternates: { canonical: '/plan' } };
}

export default async function PlanHome() {
  const tr = await getT();
  const { t, L, lang } = tr;
  const session = await getSession();
  let trips = [];
  if (session.user) {
    const db = await createClient();
    const { data } = await db.from('trips').select('id,title,start_date,days_count,status').eq('user_id', session.user.id).neq('status', 'cancelled').order('updated_at', { ascending: false }).limit(6);
    trips = data || [];
  }
  const its = (await getItineraries()).slice(0, 3);
  return (
    <div className="page">
      <PageHead eyebrow={t('nav_planner')} title={L('Plan your Uttarakhand trip', 'अपनी उत्तराखंड यात्रा प्लान करें')}
        lead={L('Real road route, weather for your dates, a day-wise plan and a budget — free, in a few minutes.', 'असली सड़क रास्ता, आपकी तारीख़ों का मौसम, दिन-वार प्लान और बजट — मुफ़्त, कुछ ही मिनट में।')} />
      <div className="row-actions">
        <Link className="btn btn-lg" href="/plan/new"><Icon name="plus" size={18} /> {t('new_trip')}</Link>
        <DraftResume label={L('Continue your unsaved plan', 'अपना अधूरा प्लान जारी रखें')} />
      </div>
      {trips.length ? (
        <section className="section">
          <div className="section-head"><h2>{t('my_trips')}</h2><Link className="link-more" href="/account/trips">{t('view_all')}</Link></div>
          <div className="ds-rows ds-panel">
            {trips.map((x) => (
              <Link key={x.id} className="ds-row" href={`/trip/${x.id}`}>
                <span className="ds-row-ico"><Icon name="map" /></span>
                <span className="grow"><strong>{x.title}</strong><span>{x.start_date ? fmtDate(x.start_date, lang) : ''}{x.days_count ? ` · ${x.days_count} ${t('days')}` : ''}</span></span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {its.length ? (
        <section className="section">
          <div className="section-head"><h2>{L('Start from a ready-made plan', 'तैयार प्लान से शुरू करें')}</h2><Link className="link-more" href="/itineraries">{t('view_all')}</Link></div>
          <Grid>{its.map((it) => <ItineraryCard key={it.id} it={it} tr={tr} />)}</Grid>
        </section>
      ) : null}
    </div>
  );
}
