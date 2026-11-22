import { Moving } from '@/components/Moving';
import { requireAdmin } from '@/lib/admin';

export default async function AdminCab() {
  await requireAdmin('/admin/cab');
  return <Moving title="Instant Cab admin" legacyPath="admin/cab" part="Part 7" />;
}
