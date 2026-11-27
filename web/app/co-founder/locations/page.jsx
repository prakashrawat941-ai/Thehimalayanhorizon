import Link from 'next/link';
import { findMatches, saveDraft, publish } from '@/app/management/location-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { LocationReview } from '@/components/dash/management';

// Matching, autofill, draft and publish are Codex's server actions (handoff D3). Until they
// exist the screen says "not connected" instead of guessing matches.
export default async function CoFounderLocations({ searchParams }) {
  const { db, user, mfaNeeded } = await requireManagement('co_founder','/co-founder/locations');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const params = await searchParams;
  const draftId = typeof params.draft === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.draft) ? params.draft : null;
  const draftColumns = 'id,fields,field_sources,match_id';
  const [list, selected] = await Promise.all([
    db.from('management_location_drafts').select('id,fields').eq('created_by', user.id).order('created_at', { ascending: false }),
    draftId ? db.from('management_location_drafts').select(draftColumns).eq('id', draftId).maybeSingle() : { data: null },
  ]);
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('Co-founder · Website', 'सह-संस्थापक · वेबसाइट')}</p><h1>{L('Add a location', 'लोकेशन जोड़ें')}</h1>
        <p className="muted">{L('New places are matched against existing places first, so nothing is added twice.', 'नई जगह पहले मौजूदा जगहों से मिलाई जाती है, ताकि कुछ दो बार न जुड़े।')}</p></div></div>
      {list.error || (draftId && !selected.data) ? <p role="alert">{L('Could not load the saved draft.', 'सेव किया हुआ ड्राफ़्ट नहीं खुल सका।')}</p> : null}
      {list.data?.length ? <details className="dsx-card" open={!!draftId}>
        <summary>{L('Saved drafts', 'सेव किए ड्राफ़्ट')}</summary>
        <ul>{list.data.map((draft) => <li key={draft.id}><Link href={`/co-founder/locations?draft=${draft.id}`}>{draft.fields.name}</Link></li>)}</ul>
      </details> : null}
      {draftId ? <Link href="/co-founder/locations">{L('Start a new location', 'नई लोकेशन शुरू करें')}</Link> : null}
      <LocationReview key={selected.data?.id || 'new'} lang={lang} initialDraft={selected.data} findMatches={findMatches} saveDraft={saveDraft} publish={publish} />
    </>
  );
}
