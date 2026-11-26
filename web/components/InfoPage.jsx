import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/data';
import { ComingSoon, PageHead } from './Blocks';
import { Icon } from './Icon';
import { PageHero } from './PageHero';
import { Photo } from './Photo';
import { PhotoCredits } from './PhotoCredits';
const TITLE = { 'our-story': 'our_story', about: 'about', 'our-office': 'our_office', privacy: 'privacy', terms: 'terms' };
// Refreshed pages get a photo header; legal pages keep the plain layout.
const PHOTO = { 'our-story': { hero: 'village', side: 'doli' }, about: { hero: 'kumaon', side: 'aipan' }, 'our-office': { hero: 'hero' } };
async function load(key) {
    const [settings, tr] = await Promise.all([getSettings(), getT()]);
    const page = (settings.pages || {})[key];
    const title = (page && tr.pick(page, 'title')) || tr.t(TITLE[key]);
    const body = page ? tr.pick(page, 'body') : '';
    return { tr, title, body, contact: settings.contact || {} };
}
export async function infoMeta(key) {
    const { title, body } = await load(key);
    return { title, description: body ? body.slice(0, 160) : undefined, alternates: { canonical: `/${key}` }, robots: body ? undefined : { index: false } };
}
const Paragraphs = ({ body }) => <div className="prose">{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>;

// Contact details come only from Admin → Settings → Contact. Nothing is shown when a value is not set.
function OfficeContact({ contact: c, tr }) {
    const { t, L } = tr;
    const wa = (c.whatsapp || '').replace(/\D/g, '');
    const cards = [
        c.address ? <div className="rf-cc" key="a"><i><Icon name="pin"/></i><span><b>{L('Address', 'पता')}</b><span>{c.address}</span></span></div> : null,
        c.phone ? <a className="rf-cc" key="p" href={`tel:${c.phone.replace(/\s/g, '')}`}><i><Icon name="phone"/></i><span><b>{L('Phone', 'फ़ोन')}</b><span>{c.phone}</span></span></a> : null,
        wa ? <a className="rf-cc" key="w" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><i><Icon name="support"/></i><span><b>WhatsApp</b><span>{c.whatsapp}</span></span></a> : null,
        c.email ? <a className="rf-cc" key="e" href={`mailto:${c.email}`}><i><Icon name="mail"/></i><span><b>{L('Email', 'ईमेल')}</b><span>{c.email}</span></span></a> : null,
    ].filter(Boolean);
    return (<section className="rf-sec">
      <h2>{L('Visit or contact us', 'हमसे मिलिए या संपर्क कीजिए')}</h2>
      {cards.length ? <div className="rf-contact">{cards}</div> : <p className="muted">{t('contact_not_set')}</p>}
      <p className="mt"><Link className="btn" href="/contact">{L('Send us a message', 'हमें संदेश भेजें')}<Icon name="arrow" size={16}/></Link></p>
    </section>);
}

export async function InfoPage({ infoKey }) {
    const { tr, title, body, contact } = await load(infoKey);
    const photo = PHOTO[infoKey];
    if (!photo) {
        return (<div className="page narrow">
          <PageHead title={title}/>
          {body ? <Paragraphs body={body}/> : <ComingSoon tr={tr}/>}
        </div>);
    }
    const { L, t, lang } = tr;
    const office = infoKey === 'our-office';
    const content = body ? <Paragraphs body={body}/> : (office ? null : <ComingSoon tr={tr}/>);
    return (<div className="rf-page">
      <PageHero lang={lang} photo={photo.hero} eyebrow={t('tagline')} title={title}/>
      <div className="wrap rf-body">
        {photo.side ? (<div className="rf-prose-split">
            <div>{content}</div>
            <div className="rf-split-img"><Photo name={photo.side} lang={lang} alt=""/></div>
          </div>) : content}
        {office ? <OfficeContact contact={contact} tr={tr}/> : null}
      </div>
      <PhotoCredits names={[photo.hero, photo.side].filter(Boolean)} L={L}/>
    </div>);
}
