import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/data';
import { ComingSoon, PageHead } from '@/components/Blocks';
// FAQs are edited by the admin in site_settings → key "faqs": [{ "q", "q_hi", "a", "a_hi" }].
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('faq'), alternates: { canonical: '/faq' } };
}
export default async function Faq() {
    const [tr, settings] = await Promise.all([getT(), getSettings()]);
    const list = (Array.isArray(settings.faqs) ? settings.faqs : []);
    const items = list.map((f) => ({ q: tr.pick(f, 'q'), a: tr.pick(f, 'a') })).filter((f) => f.q && f.a);
    const jsonLd = items.length ? {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    } : null;
    return (<div className="page">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/> : null}
      <PageHead title={tr.t('faq')}/>
      {items.length ? (<div className="faq-list">{items.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>) : <ComingSoon tr={tr}/>}
    </div>);
}
