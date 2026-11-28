import { getT } from '@/lib/i18n/server';
import { requireUser, rows } from '@/lib/account';
import { AccountNav } from '@/components/account/AccountNav';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import './partner.css';

export const metadata = { robots: { index: false } };

export default async function PartnerLayout({ children }) {
  const { db, user } = await requireUser('/partner');
  const { L } = await getT();
  const partners = await rows(db.from('partners').select('id, status, categories').eq('owner_id', user.id));
  if (!partners.length) return <div className="page">{children}</div>; // join page
  const p = partners[0];
  const [{ count: pending }, { count: tickets }] = await Promise.all([
    db.from('booking_requests').select('id', { count: 'exact', head: true }).eq('partner_id', p.id).eq('status', 'requested'),
    db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('partner_id', p.id).eq('status', 'answered'),
  ]);
  const items = [
    { href: '/partner', icon: 'home', label: L('Today', 'आज'), exact: true },
    { href: '/partner/bookings', icon: 'doc', label: L('Bookings', 'बुकिंग'), count: pending || 0 },
    { href: '/partner/calendar', icon: 'calendar', label: L('Rate calendar', 'रेट कैलेंडर') },
    { href: '/partner/properties', icon: 'house', label: L('My homestays', 'मेरे होमस्टे') },
    { href: '/partner/earnings', icon: 'layers', label: L('Earnings & payouts', 'कमाई और पेआउट') },
    { href: '/partner/kyc', icon: 'shield', label: L('KYC & bank', 'KYC और बैंक') },
    ...(p.categories?.includes('cab') ? [{href:'/partner/rides',icon:'car',label:L('Cab rides','कैब राइड')}] : []),
    {href:'/partner/requests',icon:'doc',label:L('Booking requests','बुकिंग रिक्वेस्ट')},
    { href: '/partner/services', icon: 'people', label: L('Tours & workspaces', 'टूर और वर्कस्पेस') },
    { href: '/partner/support', icon: 'support', label: L('Support', 'सहायता'), count: tickets || 0 },
    { href: '/partner/profile', icon: 'user', label: L('Business profile', 'बिज़नेस प्रोफ़ाइल') },
  ];
  return (
    <div className="ds pp">
      <AccountNav items={items} title={L('Partner portal', 'पार्टनर पोर्टल')} />
      <div className="ds-main"><div className="dsx-topbar"><ThemeToggle /></div>{children}</div>
    </div>
  );
}
