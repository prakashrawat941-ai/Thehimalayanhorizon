import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession, safeNext } from '@/lib/auth';
import { LoginForm } from './LoginForm';
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('signin'), robots: { index: false } };
}
export default async function LoginPage({ searchParams }) {
    const sp = await searchParams;
    const next = safeNext(sp.next);
    const session = await getSession();
    if (session.user)
        redirect(next);
    const { t, L } = await getT();
    // The page the user came from decides the heading (partner, driver, cab, admin).
    const who = /^\/partner/.test(next) ? 'partner' : /^\/drive/.test(next) ? 'driver' : /^\/cab/.test(next) ? 'cab' : /^\/admin/.test(next) ? 'admin' : null;
    const CTX = {
        partner: [L('Join as a partner', 'पार्टनर बनें'), L('Sign in, then add your homestay, cab or village tour details.', 'लॉगिन करें, फिर अपने होमस्टे, कैब या टूर की जानकारी भरें।')],
        driver: [L('Drive with The Himalayan Horizon', 'द हिमालयन होराइज़न के साथ गाड़ी चलाएँ'), L('Sign in, then add your profile and vehicle.', 'लॉगिन करें, फिर अपनी प्रोफ़ाइल और गाड़ी जोड़ें।')],
        cab: [L('Sign in to book your seat', 'सीट बुक करने के लिए लॉगिन करें'), L('The ride you chose is waiting for you.', 'आपकी चुनी राइड यहीं इंतज़ार कर रही है।')],
        admin: [L('Admin sign in', 'एडमिन लॉगिन'), L('Use Google with your admin email, or email and password.', 'अपने एडमिन ईमेल वाले Google या ईमेल-पासवर्ड से लॉगिन करें।')],
    };
    const text = {
        signin: t('signin'), signup: t('signup'), name: t('name'), email: t('email'), phone: t('phone'), password: t('password'),
        email_or_employee_id: L('Email or employee ID', 'ईमेल या कर्मचारी आईडी'),
        invalid_credentials: L('Invalid employee ID or password.', 'कर्मचारी आईडी या पासवर्ड गलत है।'),
        or_email: t('or_email'), loading: t('loading'), error: t('error'), forgot_password: t('forgot_password'),
        reset_sent: t('reset_sent'), check_email: t('check_email'), become_partner: t('become_partner'),
        title_signin: L('Welcome back', 'फिर से स्वागत है'), title_signup: L('Create your account', 'नया अकाउंट'),
        subtitle: L('See your trips, bookings and notifications in one place.', 'अपनी यात्राएँ, बुकिंग और सूचनाएँ एक जगह देखिए।'),
        google_note: L('New or returning, just continue with Google. An account is created automatically if you don’t have one.', 'नया हो या पुराना, Google से लॉगिन करें। अकाउंट न हो तो अपने आप बन जाएगा।'),
        google_off: L('Google sign-in is not switched on yet. Please use email for now.', 'Google लॉगिन अभी चालू नहीं है। अभी ईमेल से लॉगिन करें।'),
        google_failed: L('Google sign-in did not work. Please try again.', 'Google लॉगिन नहीं हो पाया। फिर कोशिश करें।'),
        min8: L('At least 8 characters', 'कम से कम 8 अक्षर'), send_link: L('Send reset link', 'रीसेट लिंक भेजें'),
        back_signin: L('Back to sign in', 'लॉगिन पर वापस'), partner_q: L('Run a homestay, cab or village tour?', 'होमस्टे, कैब या गाँव टूर चलाते हैं?'),
    };
    const error = sp.error ? (/denied|cancel/i.test(sp.error) ? t('google_cancelled') : `${t('google_failed')}: ${sp.error}`) : '';
    return (<div className="auth-split">
      <div className="auth-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/home/hero.jpg" alt=""/>
        <div className="auth-photo-text">
          <p className="auth-script">{L('Real People. Real Villages.', 'असली लोग। असली गाँव।')}</p>
          <p className="auth-line">{t('tagline')}</p>
        </div>
      </div>
      <div className="auth-form">
        <div style={{ width: '100%', maxWidth: 400 }}>
          {error ? <p className="form-err" role="alert">{error}</p> : null}
          <LoginForm next={next} text={text} initialMode={sp.mode === 'signup' ? 'signup' : 'signin'} heading={who ? CTX[who] : null}/>
        </div>
      </div>
    </div>);
}
