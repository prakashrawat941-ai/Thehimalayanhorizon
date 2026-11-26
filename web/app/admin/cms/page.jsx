import {requireAdmin} from '@/lib/admin';
import {CmsEditor} from '@/components/admin/CmsEditor';
export default async function Page({searchParams}) {
 const {db,user}=await requireAdmin('/admin/cms');
 return <CmsEditor db={db} user={user} searchParams={searchParams}/>;
}
