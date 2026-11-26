import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getListings, getLocations } from '@/lib/data';
import { Empty, Grid, ListingCard, PlaceCard, Section } from '@/components/Blocks';
import { PageHero } from '@/components/PageHero';
import { PhotoCredits } from '@/components/PhotoCredits';
export async function generateMetadata() {
    const { L } = await getT();
    return { title: L('Villages of Uttarakhand', 'उत्तराखंड के गाँव'), alternates: { canonical: '/villages' },
        description: L('Stay in a Himalayan village, eat with local families and learn the culture of the hills.', 'हिमालयी गाँव में रुकिए, स्थानीय परिवारों के साथ खाइए और पहाड़ की संस्कृति जानिए।') };
}
export default async function Villages() {
    const tr = await getT();
    const { t, L, lang } = tr;
    const [all, tours] = await Promise.all([getLocations(), getListings('village_tour')]);
    const vs = all.filter((l) => l.kind === 'village');
    return (<div className="rf-page">
      <PageHero lang={lang} photo="village" eyebrow={t('village_focus')} title={L('Villages of Uttarakhand', 'उत्तराखंड के गाँव')}
        lead={L('Stay in a village, eat with local families and learn folk songs, crafts, farming and temple traditions from the people who keep them alive. Your trip money goes straight to the village.', 'गाँव में रुकिए, स्थानीय परिवारों के साथ खाना खाइए, लोकगीत, हस्तकला, खेती और मंदिरों की परंपराएँ उन्हीं से सीखिए। आपकी यात्रा का पैसा सीधे गाँव तक पहुँचता है।')}/>
      <div className="wrap rf-body">
        {tours.length ? <Section title={L('Village experiences', 'गाँव के अनुभव')}><Grid>{tours.map((x) => <ListingCard key={x.id} kind="village_tour" x={x} tr={tr}/>)}</Grid></Section> : null}
        <Section title={t('villages')}>{vs.length ? <Grid>{vs.map((l) => <PlaceCard key={l.id} l={l} tr={tr}/>)}</Grid> : <Empty icon="mountain" text={t('coming_soon')}/>}</Section>
        <div className="partner-cta section">
          <div><h2>{L('Do you live in a village?', 'आप गाँव में रहते हैं?')}</h2>
            <p>{L('Host a homestay or a village walk. Register and the admin will approve you.', 'होमस्टे या गाँव का टूर चलाइए। रजिस्टर कीजिए, एडमिन मंज़ूरी देंगे।')}</p></div>
          <Link className="btn btn-lg" href="/partner/join">{t('become_partner')}</Link>
        </div>
      </div>
      <PhotoCredits names={['village']} L={L}/>
    </div>);
}
