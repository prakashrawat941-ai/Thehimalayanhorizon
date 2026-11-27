import { sendOnboarding } from '@/app/management/dashboard-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { fmtDate } from '@/lib/format';
import { loadOnboarding } from '@/lib/dash/management-data';
import { DashError } from '@/components/dash/DashStates';
import { OnboardingQueue } from '@/components/dash/management';

export default async function CoFounderOnboarding() {
  const { db, mfaNeeded } = await requireManagement('co_founder','/co-founder/onboarding');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const queue = await loadOnboarding(db);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder', 'सह-संस्थापक')}</p><h1>{L('Homestay onboarding', 'होमस्टे ऑनबोर्डिंग')}</h1>
        <p className="muted">{L('Help new hosts finish their listing. Admin gives the final approval.', 'नए होस्ट की लिस्टिंग पूरी कराएँ। अंतिम मंज़ूरी एडमिन देते हैं।')}</p></div></div>
      {queue.error ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />
        : <OnboardingQueue lang={lang} sendAction={sendOnboarding} partners={queue.data.map((p) => ({
            id: p.id, listingId: p.listingId, name: p.name, done: p.done,
            sub: [p.village, p.partner, p.at ? L(`updated ${fmtDate(p.at, lang)}`, `${fmtDate(p.at, lang)} को बदला`) : null].filter(Boolean).join(' · '),
            href: null,
          }))} />}
    </>
  );
}
