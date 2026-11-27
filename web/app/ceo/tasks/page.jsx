import { loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/management/dashboard-actions';
import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  const { db, user, mfaNeeded } = await requireManagement('ceo','/ceo/tasks');
  if (mfaNeeded) return null;
  const { L, lang } = await getT();
  const work = await loadWork(db,'ceo',user.id,'tasks');
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Team tasks', 'टीम के काम')}</h1><p className="muted">{L('Assign work to village offices and track it to done.', 'ग्राम कार्यालयों को काम दें और पूरा होने तक देखें।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Open tasks', 'खुले काम')} items={work.data || []} connected={!work.error} decide={decide} />
    </>
  );
}
