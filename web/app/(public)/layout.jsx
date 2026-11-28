import '../launch.css';
import LaunchScreen from '@/components/LaunchScreen';
import { Header, TabBar } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data';

export default async function PublicLayout({ children }) {
  const [tr, session, settings] = await Promise.all([getT(), getSession(), getSettings()]);
  const { t, L, lang } = tr;
  const brand = settings.brand || {};
  const labels = Object.fromEntries(['home', 'nav_cab', 'nav_planner', 'nav_villages', 'search', 'admin', 'partner', 'account', 'signin', 'plan_your_trip', 'villages', 'plan', 'cabs', 'notifications'].map(key => [key, t(key)]));
  return <>
    <LaunchScreen />
    <a className="skip" href="#main">{t('skip')}</a>
    <Header lang={lang} labels={labels} roles={session.roles}
      brandName={(lang === 'hi' ? brand.name_hi : brand.name) || L('The Himalayan Horizon', 'द हिमालयन होराइज़न')}
      brandSub={L('Uttarakhand · Village Travel', 'उत्तराखंड · गाँव की यात्रा')} />
    <main id="main" tabIndex={-1}>{children}</main>
    <Footer tr={tr} signedIn={!!session.user} />
    <TabBar labels={labels} />
  </>;
}
