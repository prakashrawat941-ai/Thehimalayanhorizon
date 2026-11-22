import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t, L } = await getT();
  return (
    <div className="page narrow">
      <h1>404</h1>
      <p>{L('Page not found.', 'यह पेज नहीं मिला।')}</p>
      <Link className="btn" href="/">{t('home')}</Link>
    </div>
  );
}
