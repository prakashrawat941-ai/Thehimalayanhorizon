import { requirePartner } from '@/lib/partner';
import CabScreen from '@/components/CabScreen';
export default async function Page() {
  const {partner} = await requirePartner('/partner/requests');
  return <section className="ds-body"><h1>Booking requests</h1><CabScreen area="partner" screen="manage" id={partner.id} query={{section:'requests'}}/></section>;
}
