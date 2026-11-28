import { requireManagement } from '@/lib/management/guard';
import { CmsEditor } from '@/components/admin/CmsEditor';
export const metadata = { robots: { index:false }, title:'Website content' };
export default async function Page({ searchParams }) {
 const ctx=await requireManagement('co_founder','/co-founder/cms');
 if(ctx.mfaNeeded) return null;
 return <CmsEditor db={ctx.db} user={ctx.user} base="/co-founder/cms" searchParams={searchParams} />;
}
