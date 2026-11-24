import Link from 'next/link';
import { Icon } from './Icon';
import { getT } from '@/lib/i18n/server';
import CabScreen from './CabScreen';

export default async function CabEntry() {
  const { L, lang } = await getT();
  return <div className="cab-discovery cab-home">
    <section className="cab-discovery-hero">
      <img src="/img/cab/road-hero-1200.webp" srcSet="/img/cab/road-hero-640.webp 640w, /img/cab/road-hero-1200.webp 1200w" sizes="100vw"
        width={1200} height={800} alt="" fetchPriority="high"/>
      <div className="cab-discovery-width"><h1>{L('Book a shared cab', 'शेयर्ड कैब बुक करें')}</h1>
        <p>{L('Find a seat on a local journey through Uttarakhand.', 'उत्तराखंड की स्थानीय यात्रा में अपनी सीट खोजें।')}</p></div>
    </section>
    <div className="cab-discovery-width cab-home-search">
      <CabScreen area="cab" screen="search" lang={lang}/>
      <nav className="cab-shortcuts" aria-label={L('Cab services', 'कैब सेवाएँ')}>
        <Link href="/account/cab"><Icon name="calendar" size={19}/>{L('My bookings', 'मेरी बुकिंग')}</Link>
        <Link href="/drive"><Icon name="car" size={19}/>{L('Driver dashboard', 'ड्राइवर डैशबोर्ड')}</Link>
      </nav>
    </div>
  </div>;
}
