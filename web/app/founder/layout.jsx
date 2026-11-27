import { ManagementFrame, FOUNDER_NAV } from '@/components/dash/ManagementFrame';

export const metadata = { robots: { index: false }, title: 'Founder' };

export default function Layout({ children }) {
  return <ManagementFrame role="founder" path="/founder" items={FOUNDER_NAV}>{children}</ManagementFrame>;
}
