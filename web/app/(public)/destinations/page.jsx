import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getLocations, getThemes } from '@/lib/data';
import { Empty, Grid, PlaceCard } from '@/components/Blocks';
import { FilterPills } from '@/components/Filters';
import { PlaceSearch } from '@/components/PlaceSearch';
import { PageHero } from '@/components/PageHero';
import { PhotoCredits } from '@/components/PhotoCredits';
import { searchLabels } from '@/lib/searchLabels';
export async function generateMetadata() {
    const { t, L } = await getT();
    return { title: t('destinations'), description: L('Villages, temple towns, lakes and treks across Garhwal and Kumaon.', 'गढ़वाल और कुमाऊँ के गाँव, मंदिरों वाले कस्बे, झीलें और ट्रेक।'), alternates: { canonical: '/destinations' } };
}
export default async function Destinations({ searchParams }) {
    const sp = await searchParams;
    const tr = await getT();
    const { t, L, pick, lang } = tr;
    const [all, themes] = await Promise.all([getLocations(), getThemes()]);
    const params = { region: sp.region, theme: sp.theme, kind: sp.kind };
    const list = all.filter((l) => l.kind !== 'transport_hub')
        .filter((l) => !sp.region || l.region === sp.region)
        .filter((l) => !sp.theme || (l.theme_slugs || []).includes(sp.theme))
        .filter((l) => !sp.kind || l.kind === sp.kind);
    const filtered = !!(sp.region || sp.theme || sp.kind);
    return (<div className="rf-page">
      <PageHero lang={lang} photo="kumaon" eyebrow={t('places_eyebrow')} title={L('Villages and places to discover', 'गाँव और घूमने की जगहें')}
        lead={L('Find a quiet village, a temple town or a lake. Every place has stays, local experiences and an easy way to plan your trip.', 'शांत गाँव, मंदिरों वाले कस्बे और झीलें। हर जगह के साथ होमस्टे, गाँव के अनुभव और यात्रा प्लान करने का आसान तरीका।')}/>
      <div className="wrap">
        <div className="rf-panel">
          <PlaceSearch lang={lang} labels={searchLabels(tr)}/>
          <FilterPills base="/destinations" params={params} name="region" options={[['', t('all')], ['Garhwal', t('garhwal')], ['Kumaon', t('kumaon')]]}/>
          <FilterPills base="/destinations" params={params} name="kind" options={[['', t('all')], ['village', t('villages')], ['destination', t('destinations')], ['town', L('Towns', 'कस्बे')]]}/>
          <FilterPills base="/destinations" params={params} name="theme" options={[['', t('all')], ...themes.map((th) => [th.slug, `${th.icon} ${pick(th, 'name')}`])]}/>
        </div>
        <p className="rf-count">{list.length} {t('results')}</p>
        {list.length ? <Grid>{list.map((l) => <PlaceCard key={l.id} l={l} tr={tr}/>)}</Grid>
            : <Empty icon="mountain" text={filtered ? t('nothing_here') : L('Places are being added. Check back soon.', 'जगहें जोड़ी जा रही हैं। जल्द देखिए।')}
                action={filtered ? <Link className="btn btn-ghost" href="/destinations">{t('clear_filters')}</Link> : undefined}/>}
        <div className="partner-cta rf-sec">
          <div><h2>{L('Host travellers in your village', 'अपने गाँव में यात्रियों की मेज़बानी करें')}</h2>
            <p className="muted">{L('List a homestay, a village walk or a workspace. The admin approves every listing.', 'होमस्टे, गाँव की सैर या वर्कस्पेस लिस्ट करें। हर लिस्टिंग एडमिन मंज़ूर करते हैं।')}</p></div>
          <Link className="btn btn-lg" href="/partner/join">{t('become_partner')}</Link>
        </div>
      </div>
      <PhotoCredits names={['kumaon']} L={L}/>
    </div>);
}
