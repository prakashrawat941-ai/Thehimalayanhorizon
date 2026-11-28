import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadPeople } from '@/lib/dash/management-live';
import { setMember } from '@/app/(management)/management/dashboard-actions';
import { DashError } from '@/components/dash/DashStates';
import { AccessManagement } from '@/components/dash/management';

// Admin rows are read-only; changes to team members go through the audited Founder RPC.
export default async function FounderAccess() {
  const { db, user, mfaNeeded } = await requireManagement('founder','/founder/access');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const admins = await loadPeople(db);
  if (admins.error) return <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />;
  return (
    <>
      <AccessManagement lang={lang} members={admins.data} currentUserId={user.id} setMember={setMember} />
    </>
  );
}
