import { getT } from '@/lib/i18n/server';
import { requireAdmin, count } from '@/lib/admin';
import { DashLayout } from '@/components/dash/DashLayout';

export const metadata = { robots: { index: false }, title: 'Admin' };

export default async function AdminLayout({ children }) {
  const ctx = await requireAdmin('/admin');
  const { db } = ctx;
  const { L } = await getT();
  const h = { count: 'exact', head: true };
  const [partners, homes, tours, works, kyc, payouts, tickets, reviews, messages] = await Promise.all([
    count(db.from('partners').select('id', h).eq('status', 'pending')),
    count(db.from('homestays').select('id', h).eq('status', 'pending')),
    count(db.from('village_tours').select('id', h).eq('status', 'pending')),
    count(db.from('workspaces').select('id', h).eq('status', 'pending')),
    count(db.from('partner_kyc').select('partner_id', h).eq('status', 'pending')),
    count(db.from('payout_requests').select('id', h).eq('status', 'pending')),
    count(db.from('support_tickets').select('id', h).eq('status', 'open')),
    count(db.from('destination_reviews').select('id', h).eq('status', 'pending')),
    count(db.from('contact_messages').select('id', h).eq('status', 'new')),
  ]);
  const items = [
    { href: '/admin', icon: 'home', label: L('Overview', 'ओवरव्यू') },
    { href: '/admin/partners', icon: 'people', label: L('Manage listings & partners','लिस्टिंग और पार्टनर') },
    { href: '/admin/approvals', icon: 'check', label: L('Approvals', 'मंज़ूरी'), count: partners + homes + tours + works + kyc },
    { href: '/admin/bookings', icon: 'calendar', label: L('Booking monitor', 'बुकिंग मॉनिटर') },
    { href: '/admin/homestays', icon: 'house', label: L('Homestay business', 'होमस्टे बिज़नेस') },
    { href: '/admin/payouts', icon: 'layers', label: L('Payouts', 'पेआउट'), count: payouts },
    { href: '/admin/tickets', icon: 'support', label: L('Support tickets', 'सहायता टिकट'), count: tickets },
    { href: '/admin/cms', icon: 'doc', label: L('Content (CMS)', 'कंटेंट (CMS)') },
    { href: '/admin/settings', icon: 'shield', label: L('Settings & pages', 'सेटिंग और पेज') },
    { href: '/admin/reviews', icon: 'star', label: L('Reviews', 'रिव्यू'), count: reviews },
    { href: '/admin/messages', icon: 'mail', label: L('Contact messages', 'संपर्क मैसेज'), count: messages },
    { href: '/admin/trips', icon: 'map', label: L('Trip Planner analytics', 'ट्रिप प्लानर आँकड़े') },
    { href: '/admin/users', icon: 'people', label: L('Users', 'यूज़र') },
    { href: '/admin/audit', icon: 'layers', label: L('Audit log', 'ऑडिट लॉग') },
    { href: '/admin/cab', icon: 'car', label: L('Instant Cab', 'इंस्टेंट कैब') },
  ];
  return (
    <DashLayout ctx={ctx} current="admin" title={L('Admin', 'एडमिन')} items={items} L={L}>
      {children}
    </DashLayout>
  );
}
