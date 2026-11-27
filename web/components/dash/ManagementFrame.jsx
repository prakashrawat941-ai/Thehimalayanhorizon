import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import Mfa from '@/app/management/Mfa';
import { DashMfaNeeded } from './DashStates';
import { DASHBOARDS } from '@/lib/dashboards';
import { DashLayout } from './DashLayout';

export async function ManagementFrame({ role, path, items, children }) {
  const ctx = await requireManagement(role, path);
  const { L, lang } = await getT();
  return (
    <DashLayout ctx={ctx} managementRole={ctx.mfaNeeded ? null : ctx.managementRole} current={role} title={L(...DASHBOARDS[role].label)} items={items(L)} L={L}>
      {ctx.mfaNeeded ? <DashMfaNeeded title={L('Two-step verification required', 'दो-चरण सत्यापन ज़रूरी')}><Mfa lang={lang} /></DashMfaNeeded> : children}
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
  { href: '/co-founder/cms', icon: 'doc', label: L('Content editor', 'कंटेंट एडिटर') },
  { href: '/co-founder/locations', icon: 'pin', label: L('Add a location', 'लोकेशन जोड़ें') },
  { href: '/co-founder/onboarding', icon: 'house', label: L('Homestay onboarding', 'होमस्टे ऑनबोर्डिंग') },
  { href: '/co-founder/releases', icon: 'arrow', label: L('App releases', 'ऐप रिलीज़') },
];
