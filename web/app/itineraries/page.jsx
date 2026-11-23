import { getT } from '@/lib/i18n/server';
import { getItineraries, getThemes } from '@/lib/data';
import { Empty, Grid, ItineraryCard, PageHead } from '@/components/Blocks';
import { FilterPills } from '@/components/Filters';
export async function generateMetadata() {
    const { t, L } = await getT();
    return { title: t('itineraries'), alternates: { canonical: '/itineraries' }, description: L('Ready-made Uttarakhand trip plans. Start from one, then make it your own.', 'उत्तराखंड के तैयार यात्रा प्लान। किसी से शुरू कीजिए, फिर अपने हिसाब से बदलिए।') };
}
export default async function Itineraries({ searchParams }) {
    const sp = await searchParams;
    const tr = await getT();
    const { t, L, pick } = tr;
    const [list, themes] = await Promise.all([getItineraries(), getThemes()]);
    const params = { theme: sp.theme, region: sp.region };
    const shown = list.filter((it) => !sp.theme || (it.theme_slugs || []).includes(sp.theme))
        .filter((it) => !sp.region || it.region === sp.region || it.region === 'Both');
    return (<div className="page">
      <PageHead title={t('itineraries')} lead={L('Start from a plan, then make it your own.', 'किसी प्लान से शुरू कीजिए, फिर उसे अपने हिसाब से बदलिए।')}/>
      <FilterPills base="/itineraries" params={params} name="region" options={[['', t('all')], ['Garhwal', t('garhwal')], ['Kumaon', t('kumaon')]]}/>
      <FilterPills base="/itineraries" params={params} name="theme" options={[['', t('all')], ...themes.map((th) => [th.slug, `${th.icon} ${pick(th, 'name')}`])]}/>
      {shown.length ? <Grid>{shown.map((it) => <ItineraryCard key={it.id} it={it} tr={tr}/>)}</Grid> : <Empty text={t('nothing_here')}/>}
    </div>);
}
