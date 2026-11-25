import CabEntry from '@/components/CabEntry';
import { notFound } from 'next/navigation';
import CabScreen from '@/components/CabScreen';
import { getLang } from '@/lib/i18n/server';
import '../cab-discovery.css';
import '../cab-booking.css';
const screens = {'find': 'find', 'ride/:id': 'ride', 'booking/:id': 'booking', 'bookings': 'bookings', 'me': 'me'};
export default async function Page({ params, searchParams }) {
  const { segments = [] } = await params;
  if (!segments.length) return <CabEntry/>;
  const key = segments.map((segment, index) => index === 1 && ['ride','trip','booking'].includes(segments[0]) ? ':id' : segment).join('/');
  if (!Object.hasOwn(screens, key)) notFound();
  return <CabScreen area="cab" screen={screens[key]} id={segments[1] || ''} query={await searchParams} lang={await getLang()} />;
}
