import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/partner';
import CabScreen from '@/components/CabScreen';
export default async function Page() {
  const {partner} = await requirePartner('/partner/rides');
  if (!partner.categories?.includes('cab')) notFound();
  return <section className="ds-body"><h1>Cab rides</h1><CabScreen area="partner" screen="manage" id={partner.id} query={{section:'rides'}}/></section>;
}
