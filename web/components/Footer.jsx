import Link from 'next/link';
import { APP_VERSION } from '@/lib/config';
import { LangToggle } from './LangToggle';
export function Footer({ tr, signedIn }) {
    const { t, L } = tr;
    const col = (title, links) => (<div className="footer-col">
      <strong>{title}</strong>
      {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
    </div>);
    return (<footer className="footer">
      <div className="footer-inner">
        <Link className="footer-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="footer-mark" src="/img/brand/mark.png" alt="" width={48} height={46}/>
          <span><strong>{L('The Himalayan Horizon', 'द हिमालयन होराइज़न')}</strong><small>{t('tagline')}</small></span>
        </Link>
        <div className="footer-cols">
          {col(t('explore'), [['/destinations', t('destinations')], ['/villages', t('villages')], ['/experiences', t('experiences')], ['/itineraries', t('itineraries')]])}
          {col(L('Book', 'बुक करें'), [['/homestays', t('stays')], ['/village-tours', t('village_tours')], ['/workspaces', t('workspaces')], ['/cab', t('cabs')], ['/plan', t('nav_planner')]])}
          {col(t('footer_about'), [['/our-story', t('our_story')], ['/about', t('about')], ['/our-office', t('our_office')], ['/blog', t('blog')], ['/gallery', t('gallery')]])}
          {col(t('footer_help'), [['/contact', t('contact')], ['/faq', t('faq')], ['/partner/join', t('become_partner')], ['/privacy', t('privacy')], ['/terms', t('terms')]])}
        </div>
        <div className="footer-end">
          <span className="muted small">© {new Date().getFullYear()} The Himalayan Horizon · {t('footer_note')} · v{APP_VERSION}</span>
          <LangToggle lang={tr.lang} signedIn={signedIn}/>
        </div>
      </div>
    </footer>);
}
