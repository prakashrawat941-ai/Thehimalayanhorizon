import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { loadAdmins } from '@/lib/dash/management-data';
import { DashError, DashNotConnected } from '@/components/dash/DashStates';
import { AccessManagement } from '@/components/dash/management';

// Admins (profiles.role = 'admin', owner-set) are listed read-only. Adding or changing team
// roles needs Codex's Founder-only setMember action (handoff D2), so no edit buttons yet.
export default async function FounderAccess() {
  const { db, user } = await requireAdmin('/founder/access');
  const { L, lang } = await getT();
  const admins = await loadAdmins(db);
  if (admins.error) return <DashError title={L('Couldn’t load this', 'यह लोड नहीं हुआ')} text={L('Check your connection and try again. Nothing was changed.', 'कनेक्शन जाँचकर फिर कोशिश करें। कुछ नहीं बदला गया।')} retry={L('Try again', 'फिर कोशिश करें')} />;
  return (
    <>
      <AccessManagement lang={lang} members={admins.data} currentUserId={user.id} setMember={null} />
      <DashNotConnected title={L('Team roles are not connected yet', 'टीम की भूमिकाएँ अभी जुड़ी नहीं')}
        text={L('CEO, Co-founder and village office people will appear here, with add, change and remove, once management access is live.', 'मैनेजमेंट एक्सेस चालू होते ही CEO, सह-संस्थापक और ग्राम कार्यालय के लोग यहाँ दिखेंगे — जोड़ने, बदलने और हटाने के साथ।')} />
    </>
  );
}
