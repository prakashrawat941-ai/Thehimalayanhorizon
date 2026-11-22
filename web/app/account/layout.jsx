import { getT } from '@/lib/i18n/server';
import { requireUser } from '@/lib/account';
import { AccountNav } from '@/components/account/AccountNav';

export const metadata = { robots: { index: false } };

export default async function AccountLayout({ children }) {
  const { db, user } = await requireUser('/account');
  const { L } = await getT();
  const [unread, requests] = await Promise.all([
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
    db.from('cab_bookings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
  ]);
  const items = [
    { href: '/account', icon: 'home', label: L('Overview', 'ओवरव्यू') },
    { href: '/account/bookings', icon: 'house', label: L('Stays & tours', 'होमस्टे और टूर') },
    { href: '/account/cab', icon: 'car', label: L('Cab bookings', 'कैब बुकिंग'), count: requests.count || 0 },
    { href: '/account/trips', icon: 'map', label: L('My trips', 'मेरी यात्राएँ') },
    { href: '/account/saved', icon: 'heart', label: L('Saved places', 'सेव की जगहें') },
    { href: '/account/reviews', icon: 'star', label: L('My reviews', 'मेरे रिव्यू') },
    { href: '/account/notifications', icon: 'bell', label: L('Notifications', 'सूचनाएँ'), count: unread.count || 0 },
    { href: '/account/profile', icon: 'user', label: L('Profile', 'प्रोफ़ाइल') },
  ];
  return (
    <div className="ds">
      <AccountNav items={items} title={L('My account', 'मेरा अकाउंट')} />
      <div className="ds-main">{children}</div>
    </div>
  );
}
