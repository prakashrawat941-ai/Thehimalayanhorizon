import './globals.css';
import '@/styles/theme.css';
import '@/styles/tokens.css';
import '@/styles/ui.css';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { normalizeTheme } from '@/components/theme/theme';
import { getT } from '@/lib/i18n/server';
import { SITE_URL } from '@/lib/config';
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
    const [{ t, lang }, cookieStore] = await Promise.all([getT(), cookies()]);
    const theme = normalizeTheme(cookieStore.get('thh_theme')?.value);
    return (<html lang={lang} data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Mukta:wght@400;500;600;700&family=Caveat:wght@600&family=Tiro+Devanagari+Hindi&display=swap"/>
      </head>
      <body><ThemeProvider initialTheme={theme}>
        {children}
        <PwaRegister labels={{ update_ready: t('update_ready'), reload: t('reload') }}/>
      </ThemeProvider></body>
    </html>);
}
