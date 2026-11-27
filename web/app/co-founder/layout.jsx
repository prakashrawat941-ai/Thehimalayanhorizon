import { ManagementFrame, COFOUNDER_NAV } from '@/components/dash/ManagementFrame';

export const metadata = { robots: { index: false }, title: 'Co-founder' };

export default function Layout({ children }) {
  return <ManagementFrame role="co_founder" path="/co-founder" items={COFOUNDER_NAV}>{children}</ManagementFrame>;
}
