import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { WorkQueue } from '@/components/dash/management';

// management_work is not live yet (handoff D1): the list shows "Not connected yet", never sample rows.
export default async function Page() {
  await requireAdmin('/ceo/tasks');
  const { L, lang } = await getT();
  return (
    <>
      <div className="ds-head"><div className="grow"><p className="eyebrow">{L('CEO', 'मुख्य कार्यकारी')}</p><h1>{L('Team tasks', 'टीम के काम')}</h1><p className="muted">{L('Assign work to village offices and track it to done.', 'ग्राम कार्यालयों को काम दें और पूरा होने तक देखें।')}</p></div></div>
      <WorkQueue lang={lang} title={L('Open tasks', 'खुले काम')} items={[]} connected={false} />
    </>
  );
}
