import { getT } from '@/lib/i18n/server';
import InviteAccept from './InviteAccept';
export const metadata = { robots: { index: false }, title: 'Accept team invitation' };
export default async function Page() {
 const {lang}=await getT();
 return <main className="container"><InviteAccept lang={lang} /></main>;
}
