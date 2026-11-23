import { notFound } from 'next/navigation';
import CabScreen from '@/components/CabScreen';
const screens = {'': 'entry', 'find': 'find', 'ride/:id': 'ride', 'booking/:id': 'booking', 'bookings': 'bookings', 'me': 'me'};
export default async function Page({ params, searchParams }) {
  const { segments = [] } = await params;
  const key = segments.map((segment, index) => index === 1 && ['ride','trip','booking'].includes(segments[0]) ? ':id' : segment).join('/');
  if (!Object.hasOwn(screens, key)) notFound();
  return <CabScreen area="cab" screen={screens[key]} id={segments[1] || ''} query={await searchParams} />;
}
