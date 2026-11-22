import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/data';
import { PageHead } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { ContactForm } from './ContactForm';
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('contact'), alternates: { canonical: '/contact' } };
}
export default async function Contact() {
    const [tr, settings] = await Promise.all([getT(), getSettings()]);
    const { t, L, lang } = tr;
    const c = (settings.contact || {});
    const social = (settings.social || {});
    const wa = (c.whatsapp || '').replace(/\D/g, '');
    const has = c.phone || wa || c.email;
    const text = {
        name: t('name'), email: t('email'), phone: t('phone'), your_message: t('your_message'), send_message: t('send_message'),
        message_sent: t('message_sent'), contact_unavailable: t('contact_unavailable'), loading: t('loading'),
        err_name: L('Please enter your name.', 'कृपया अपना नाम लिखें।'), err_email: L('Please enter a valid email.', 'कृपया सही ईमेल लिखें।'),
        err_phone: L('Please check the phone number.', 'कृपया फ़ोन नंबर जाँचें।'), err_message: L('Please write a message (at least 5 letters).', 'कृपया मैसेज लिखें (कम से कम 5 अक्षर)।'),
        err_rate: L('Too many messages. Please try again in a few minutes.', 'बहुत सारे मैसेज। कुछ मिनट बाद कोशिश करें।'), err_server: t('error'),
    };
    return (<div className="page">
      <PageHead title={t('contact')} lead={L('Questions about a trip, a stay or becoming a partner? Write to us.', 'यात्रा, होमस्टे या पार्टनर बनने के बारे में सवाल? हमें लिखिए।')}/>
      <div className="info-grid">
        <div className="panel"><ContactForm text={text} lang={lang}/></div>
        <div className="panel">
          <h2>{t('contact_details')}</h2>
          {has ? (<>
              {c.phone ? <p className="contact-line"><Icon name="phone"/> <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></p> : null}
              {wa ? <p className="contact-line"><Icon name="support"/> <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></p> : null}
              {c.email ? <p className="contact-line"><Icon name="mail"/> <a href={`mailto:${c.email}`}>{c.email}</a></p> : null}
            </>) : <p className="muted">{t('contact_not_set')}</p>}
          {c.address ? <p className="contact-line"><Icon name="pin"/> {c.address}</p> : null}
          {Object.entries(social).filter(([, v]) => v).length ? (<div className="row-actions mt">{Object.entries(social).filter(([, v]) => v && /^https:\/\//.test(v)).map(([k, v]) => <a key={k} className="btn btn-ghost btn-sm" href={v} target="_blank" rel="noopener noreferrer">{k}</a>)}</div>) : null}
          <div className="soft-note mt">{L('In an emergency in Uttarakhand call 112 (all emergencies) or 1070 (state disaster control room).', 'उत्तराखंड में आपात स्थिति में 112 (सभी आपात) या 1070 (राज्य आपदा कंट्रोल रूम) पर कॉल करें।')}</div>
        </div>
      </div>
    </div>);
}
