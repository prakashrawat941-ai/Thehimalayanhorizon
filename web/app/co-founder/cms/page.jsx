import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/account';
import { CmsEditor } from '@/components/admin/CmsEditor';
export default async function Page({ searchParams }) {
  const { db, user } = await requireUser('/co-founder/cms');
  const { data } = await db
    .from('management_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (data?.role !== 'co_founder') notFound();
  if (
    (await db.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel !==
    'aal2'
  )
    redirect('/co-founder');
  return (
    <CmsEditor
      db={db}
      user={user}
      base="/co-founder/cms"
      searchParams={searchParams}
    />
  );
}
