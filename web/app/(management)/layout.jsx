import { getT } from '@/lib/i18n/server';
import styles from './workspace.module.css';

export const metadata = { robots: { index: false, follow: false } };

export default async function ManagementLayout({ children }) {
  const { L } = await getT();
  return <div className={styles.workspace} data-portal="management">
    <a className="skip" href="#management-content">{L('Skip to workspace', 'सीधे कार्यक्षेत्र पर जाएँ')}</a>
    <div id="management-content" tabIndex={-1}>{children}</div>
  </div>;
}
