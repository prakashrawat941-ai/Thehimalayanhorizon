import { requireManagement } from '@/lib/management/guard';
import { getT } from '@/lib/i18n/server';
import { DashMfaNeeded } from '@/components/dash/DashStates';
import { DashLayout } from '@/components/dash/DashLayout';
import Mfa from '@/app/(management)/management/Mfa';
import Attendance from './Attendance';
import '@/app/dash.css';
export const metadata={robots:{index:false},title:'Village office'};
export default async function Page() {
 const ctx=await requireManagement('employee','/employee');
 const {lang,L}=await getT();
 if(ctx.mfaNeeded) return <DashMfaNeeded title={L('Two-step verification required','दो-चरण सत्यापन ज़रूरी')}><Mfa lang={lang}/></DashMfaNeeded>;
 const title = L('Employee workspace', 'कर्मचारी कार्यक्षेत्र');
 const items = [{ href: '/employee', icon: 'home', label: L('Village office', 'ग्राम कार्यालय'), exact: true }];
 return <DashLayout ctx={ctx} managementRole="employee" current="employee" title={title} items={items} L={L}>
   <main className="container"><h1>{L('Village office', 'ग्राम कार्यालय')}</h1><Attendance lang={lang}/></main>
 </DashLayout>;
}
