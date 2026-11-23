import Link from 'next/link';
import CabScreen from '@/components/CabScreen';
import { requireAdmin } from '@/lib/admin';
export default async function AdminCab({ searchParams }) {
  await requireAdmin('/admin/cab');
  const query = await searchParams;
  const screens = { drivers: 'driversAdmin', vehicles: 'vehiclesAdmin', rides: 'rides' };
  const tab = Object.hasOwn(screens, query.tab) ? query.tab : 'rides';
  return <><nav className="seg-tabs" aria-label="Cab administration">{Object.keys(screens).map(key =>
    <Link key={key} className={tab === key ? 'on' : ''} href={'/admin/cab?tab=' + key}>{key}</Link>)}</nav>
    <CabScreen area="admin" screen={screens[tab]} query={query} /></>;
}
