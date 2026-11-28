import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadSections } from '@/lib/dash/management-data';
import { DashError } from '@/components/dash/DashStates';
import { CmsSections } from '@/components/dash/management';

export default async function CoFounderWebsite() {
  const { db, mfaNeeded } = await requireManagement('co_founder','/co-founder');
  if (mfaNeeded) return null;
  const { L, lang, pick } = await getT();
  const sections = await loadSections(db);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder', 'सह-संस्थापक')}</p><h1>{L('Website', 'वेबसाइट')}</h1>
        <p className="muted">{L('Homepage sections and places. Changes are logged.', 'होमपेज सेक्शन और जगहें। बदलाव लॉग होते हैं।')}</p></div>
        <Link className="btn" href="/co-founder/locations">{L('+ Add a location', '+ लोकेशन जोड़ें')}</Link></div>
      {sections.error ? <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />
        : <CmsSections editHref="/co-founder/cms" lang={lang} sections={sections.data.map((s) => ({ id: s.id, title: pick(s, 'title') || s.kind, enabled: s.enabled, position: s.position, note: s.kind }))} />}
    </>
  );
}
