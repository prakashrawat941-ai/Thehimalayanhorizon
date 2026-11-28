import { getT } from '@/lib/i18n/server';
import { requireUser } from '@/lib/account';
import { ProfileForm, PhotoUpload, PasswordForm } from './ProfileForms';
import { Icon } from '@/components/Icon';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t('profile') };
}

export default async function Profile() {
  const { user, profile } = await requireUser('/account/profile');
  const { t, L } = await getT();
  const p = profile || {};
  const name = p.full_name || user.email || '';
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '•';
  const text = {
    name: t('name'), phone: t('phone'), email: t('email'), save: t('save'), saved: t('saved'), loading: t('loading'),
    phone_note: L('Shared only with hosts or drivers you book with, after confirmation.', 'सिर्फ़ उन होस्ट या ड्राइवर को दिखता है जिनके साथ आपकी बुकिंग कन्फर्म हो।'),
    ec_title: L('Emergency contact', 'आपातकालीन संपर्क'),
    ec_note: L('Used only if you press SOS during a ride, so our team can reach someone close to you.', 'सिर्फ़ तब इस्तेमाल होगा जब आप राइड में SOS दबाएँ, ताकि हमारी टीम आपके किसी अपने तक पहुँच सके।'),
    ec_name: L('Name', 'नाम'), ec_phone: L('Phone', 'फ़ोन'), language: L('Language', 'भाषा'),
    err_name: L('Please enter your name (2–120 letters).', 'कृपया अपना नाम लिखें (2–120 अक्षर)।'),
    err_phone: L('Please check your phone number.', 'कृपया अपना फ़ोन नंबर जाँचें।'),
    err_ec_name: L('Emergency contact name is too long.', 'आपातकालीन संपर्क का नाम बहुत लंबा है।'),
    err_ec_phone: L('Please check the emergency contact phone.', 'कृपया आपातकालीन संपर्क का फ़ोन जाँचें।'),
    err_ec_same: L('Emergency contact should be someone else’s number.', 'आपातकालीन संपर्क किसी और का नंबर होना चाहिए।'),
    err_auth: L('Please sign in again.', 'कृपया फिर से लॉगिन करें।'), err_server: t('error'),
  };
  const photoText = {
    loading: t('loading'), change_photo: L('Change photo', 'फ़ोटो बदलें'), photo_hint: L('JPG, PNG or WebP, up to 5 MB.', 'JPG, PNG या WebP, 5 MB तक।'),
    photo_type: L('Please choose a JPG, PNG or WebP image.', 'कृपया JPG, PNG या WebP फ़ोटो चुनें।'), photo_size: L('Image must be under 5 MB.', 'फ़ोटो 5 MB से छोटी होनी चाहिए।'),
    photo_ok: L('Photo updated', 'फ़ोटो बदल गई'),
  };
  const pwText = { new_password: t('new_password'), min8: L('At least 8 characters', 'कम से कम 8 अक्षर'), change_password: L('Change password', 'पासवर्ड बदलें'), saved: t('password_updated') };
  const ecMissing = !p.emergency_contact_phone;
  return (
    <>
      <div className="ac-head"><div><h1>{t('profile')}</h1></div></div>
      {ecMissing ? <div className="ac-banner"><Icon name="alert" /><span><b>{L('Add an emergency contact', 'आपातकालीन संपर्क जोड़ें')}</b>
        <p>{L('Used only if you press SOS during a cab ride. You can add it in the form below.', 'सिर्फ़ कैब राइड में SOS दबाने पर इस्तेमाल होगा। नीचे फ़ॉर्म में जोड़ सकते हैं।')}</p></span></div> : null}
      <div className="ac-cols">
        <section className="ac-card">
          <h2>{L('Your details', 'आपकी जानकारी')}</h2>
          <PhotoUpload userId={user.id} url={p.avatar_url || null} initials={initials} text={photoText} />
          <ProfileForm profile={p} email={user.email || ''} text={text} />
        </section>
        <section className="ac-card">
          <h2>{L('Sign-in', 'लॉगिन')}</h2>
          <PasswordForm text={pwText} />
          <form action="/auth/signout" method="post" style={{ marginTop: 14 }}><button className="btn btn-danger-ghost btn-sm">{t('signout')}</button></form>
        </section>
      </div>
    </>
  );
}
