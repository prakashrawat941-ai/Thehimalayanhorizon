import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { WorkWorkspace } from '@/components/work/WorkWorkspace';

export const metadata = { robots: { index: false } };

// Task service not connected yet: source is null, so the workspace shows "Not connected yet" and no tasks.
// Codex's adapter will pass source="backend" with server-derived people and actor (docs/DATA-CONTRACTS.md).
export default async function Page() {
  await requireAdmin('/co-founder/work');
  const { lang } = await getT();
  return <WorkWorkspace lang={lang} source={null} roleTitle="THH Work · Co-Founder" />;
}
