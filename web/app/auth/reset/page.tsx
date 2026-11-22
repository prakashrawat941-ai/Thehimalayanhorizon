import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { ResetForm } from './ResetForm';

export const metadata = { robots: { index: false } };

export default async function ResetPage() {
  const session = await getSession();
  if (!session.user) redirect('/login');
  const { t } = await getT();
  return (
    <div className="page narrow auth">
      <h1>{t('update_password')}</h1>
      <ResetForm text={{ new_password: t('new_password'), update_password: t('update_password'), password_updated: t('password_updated') }} />
    </div>
  );
}
