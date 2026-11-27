import { requireManagement } from '@/lib/management/guard';
import { getT } from '@/lib/i18n/server';
import { DashMfaNeeded } from '@/components/dash/DashStates';
import Mfa from '@/app/management/Mfa';
import Attendance from './Attendance';
import '@/app/dash.css';
export const metadata={robots:{index:false},title:'Village office'};
export default async function Page() {
 const ctx=await requireManagement('employee','/employee');
 const {lang,L}=await getT();
 if(ctx.mfaNeeded) return <DashMfaNeeded title={L('Two-step verification required','दो-चरण सत्यापन ज़रूरी')}><Mfa lang={lang}/></DashMfaNeeded>;
 return <main className="container"><h1>{L('Village office','ग्राम कार्यालय')}</h1><Attendance lang={lang}/></main>;
}
