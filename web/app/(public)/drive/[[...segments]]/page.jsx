import { requireUser } from '@/lib/account';
import { notFound } from 'next/navigation';
import CabScreen from '@/components/CabScreen';
const screens = {'': 'dashboard', 'publish': 'publish', 'ride/:id/edit': 'publish', 'rides': 'rides', 'requests': 'requests', 'trip/:id': 'trip', 'profile': 'profile'};
export default async function Page({ params, searchParams }) {
  const { segments = [] } = await params;
  const key = segments.map((segment, index) => index === 1 && ['ride','trip','booking'].includes(segments[0]) ? ':id' : segment).join('/');
  if (!Object.hasOwn(screens, key)) notFound();
  await requireUser('/drive' + (segments.length ? '/' + segments.join('/') : ''));
  return <CabScreen area="drive" screen={screens[key]} id={segments[1] || ''} query={await searchParams} />;
}
