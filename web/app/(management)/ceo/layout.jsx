import { ManagementFrame, CEO_NAV } from '@/components/dash/ManagementFrame';

export const metadata = { robots: { index: false }, title: 'CEO' };

export default function Layout({ children }) {
  return <ManagementFrame role="ceo" path="/ceo" items={CEO_NAV}>{children}</ManagementFrame>;
}
