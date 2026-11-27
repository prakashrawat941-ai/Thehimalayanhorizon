import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { LocationReview } from '@/components/dash/management';

// Matching, autofill, draft and publish are Codex's server actions (handoff D3). Until they
// exist the screen says "not connected" instead of guessing matches.
export default async function CoFounderLocations() {
  await requireAdmin('/co-founder/locations');
  const { L, lang } = await getT();
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder · Website', 'सह-संस्थापक · वेबसाइट')}</p><h1>{L('Add a location', 'लोकेशन जोड़ें')}</h1>
        <p className="muted">{L('New places are matched against existing places first, so nothing is added twice.', 'नई जगह पहले मौजूदा जगहों से मिलाई जाती है, ताकि कुछ दो बार न जुड़े।')}</p></div></div>
      <LocationReview lang={lang} findMatches={null} saveDraft={null} publish={null} />
    </>
  );
}
