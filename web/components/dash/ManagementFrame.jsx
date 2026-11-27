import { getT } from '@/lib/i18n/server';
import { requireAdmin } from '@/lib/admin';
import { DASHBOARDS } from '@/lib/dashboards';
import { DashLayout } from './DashLayout';

/**
 * Frame for /founder, /ceo and /co-founder. GUARD (temporary, handoff D1): requireAdmin —
 * only the owner-set admin role can open these until Codex's management_members + MFA guard
 * replaces it. Pages show existing-table data only; management-only parts say "Not connected yet".
 */
export async function ManagementFrame({ role, path, items, children }) {
  const ctx = await requireAdmin(path);
  const { L } = await getT();
  return (
    <DashLayout ctx={ctx} current={role} title={L(...DASHBOARDS[role].label)} items={items(L)} L={L}>
      <p className="dsx-info" role="note">
        <b>{L('Owner view', 'मालिक का व्यू')}</b>
        {L('Only admins can open this dashboard for now. Team roles (CEO, Co-founder, village office) and two-step verification will be connected by Codex; parts that need them say “Not connected yet”.',
          'अभी यह डैशबोर्ड सिर्फ़ एडमिन खोल सकते हैं। टीम की भूमिकाएँ (CEO, सह-संस्थापक, ग्राम कार्यालय) और दो-चरण सत्यापन Codex जोड़ेगा; जिन हिस्सों को इनकी ज़रूरत है वहाँ “अभी जुड़ा नहीं” लिखा है।')}
      </p>
      {children}
    </DashLayout>
  );
}

export const FOUNDER_NAV = (L) => [
  { href: '/founder', icon: 'home', label: L('Overview', 'ओवरव्यू'), exact: true },
  { href: '/founder/access', icon: 'shield', label: L('Access management', 'एक्सेस प्रबंधन') },
  { href: '/founder/approvals', icon: 'check', label: L('My approvals', 'मेरी मंज़ूरियाँ') },
  { href: '/founder/audit', icon: 'layers', label: L('Audit log', 'ऑडिट लॉग') },
];
export const CEO_NAV = (L) => [
  { href: '/ceo', icon: 'route', label: L('Operations today', 'आज का संचालन'), exact: true },
  { href: '/ceo/tasks', icon: 'check', label: L('Team tasks', 'टीम के काम') },
  { href: '/ceo/reviews', icon: 'shield', label: L('Approve requests', 'अनुरोध मंज़ूर करें') },
  { href: '/ceo/requests', icon: 'layers', label: L('Sent to Founder', 'संस्थापक को भेजे') },
];
export const COFOUNDER_NAV = (L) => [
  { href: '/co-founder', icon: 'globe', label: L('Website', 'वेबसाइट'), exact: true },
  { href: '/co-founder/locations', icon: 'pin', label: L('Add a location', 'लोकेशन जोड़ें') },
  { href: '/co-founder/onboarding', icon: 'house', label: L('Homestay onboarding', 'होमस्टे ऑनबोर्डिंग') },
  { href: '/co-founder/releases', icon: 'arrow', label: L('App releases', 'ऐप रिलीज़') },
];
