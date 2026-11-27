import './launch.css';
import LaunchScreen from '@/components/LaunchScreen';
import './globals.css';
import '@/styles/tokens.css';
import '@/styles/brand-dark.generated.css';
import '@/styles/ui.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme/theme';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/data';
import { SITE_URL } from '@/lib/config';
import { Header, TabBar } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PwaRegister } from '@/components/PwaRegister';
export async function generateMetadata() {
    const { L, t } = await getT();
    const brand = L('The Himalayan Horizon', 'द हिमालयन होराइज़न');
    const description = L('Discover the Himalayas beyond the ordinary: Uttarakhand villages, local homestays, trip planner and shared cabs.', 'हिमालय को साधारण से आगे जानिए: उत्तराखंड के गाँव, स्थानीय होमस्टे, ट्रिप प्लानर और शेयर्ड कैब।');
    return {
        metadataBase: new URL(SITE_URL),
        title: { default: `${brand} — ${t('tagline')}`, template: `%s · ${brand}` },
        description,
        applicationName: 'The Himalayan Horizon',
        manifest: '/manifest.webmanifest',
        icons: {
            icon: [{ url: '/icons/signature-favicon-32.png', sizes: '32x32' }, { url: '/icons/signature-favicon-48.png', sizes: '48x48' }],
            apple: '/icons/signature-apple-touch-icon.png',
        },
        appleWebApp: { capable: true, title: 'Himalayan Horizon', statusBarStyle: 'default' },
        openGraph: { type: 'website', siteName: 'The Himalayan Horizon', title: brand, description, images: ['/img/brand/og-image.jpg'], locale: 'hi_IN', alternateLocale: 'en_IN' },
        twitter: { card: 'summary_large_image', images: ['/img/brand/og-image.jpg'] },
    };
}
export const viewport = { themeColor: '#1f4d3a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default async function RootLayout({ children }) {
    const [tr, session, settings] = await Promise.all([getT(), getSession(), getSettings()]);
    const { t, L, lang } = tr;
    const brand = settings.brand || {};
    const labels = Object.fromEntries(['home', 'nav_cab', 'nav_planner', 'nav_villages', 'search', 'admin', 'partner', 'account', 'signin', 'plan_your_trip', 'villages', 'plan', 'cabs', 'notifications']
        .map((k) => [k, t(k)]));
    return (<html lang={lang} suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark choice before first paint (no flash). Static string, no user input. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Mukta:wght@400;500;600;700&family=Caveat:wght@600&family=Tiro+Devanagari+Hindi&display=swap"/>
      </head>
      <body>
        <LaunchScreen />
        <a className="skip" href="#main">{t('skip')}</a>
        <Header lang={lang} labels={labels} roles={session.roles} brandName={(lang === 'hi' ? brand.name_hi : brand.name) || L('The Himalayan Horizon', 'द हिमालयन होराइज़न')} brandSub={L('Uttarakhand · Village Travel', 'उत्तराखंड · गाँव की यात्रा')}/>
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer tr={tr} signedIn={!!session.user}/>
        <TabBar labels={labels}/>
        <PwaRegister labels={{ update_ready: t('update_ready'), reload: t('reload') }}/>
      </body>
    </html>);
}
