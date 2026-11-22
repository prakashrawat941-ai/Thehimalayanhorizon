import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getThemes } from '@/lib/data';
import { Empty, PageHead } from '@/components/Blocks';
import { Cover } from '@/components/Cover';

export async function generateMetadata(): Promise<Metadata> {
  const { t, L } = await getT();
  return { title: t('experiences'), alternates: { canonical: '/experiences' }, description: L('Trekking, temples, wildlife, village life and Pahadi food in Uttarakhand.', 'उत्तराखंड में ट्रेकिंग, मंदिर, वन्यजीव, गाँव का जीवन और पहाड़ी खाना।') };
}

export default async function Experiences() {
  const tr = await getT();
  const { t, L, pick } = tr;
  const themes = await getThemes();
  return (
    <div className="page">
      <PageHead eyebrow={t('places_eyebrow')} title={t('experiences')} lead={L('Travel by what you love.', 'अपनी पसंद से घूमिए।')} />
      {themes.length ? (
        <div className="grid grid-3">
          {themes.map((th) => (
            <Link key={th.id} className="card" href={`/experiences/${th.slug}`}>
              <div className="card-media"><Cover url={th.image_url} seed={th.slug} /><span className="card-tag">{th.icon}</span></div>
              <div className="card-body"><h3 className="card-title">{pick(th, 'name')}</h3><p className="card-sub">{pick(th, 'summary')}</p></div>
            </Link>
          ))}
        </div>
      ) : <Empty text={t('coming_soon')} />}
    </div>
  );
}
