import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import CabScreen from '@/components/CabScreen';

const sections = {partners:'Partners', homestay:'Homestays', village_tour:'Village tours', workspace:'Workspaces', requests:'Booking requests'};
export default async function Operations({params,searchParams}) {
  const {operation} = await params;
  if (!Object.hasOwn(sections,operation)) notFound();
  await requireAdmin('/admin/' + operation);
  return <section className="ds-body"><h1>{sections[operation]}</h1>
    <nav className="seg-tabs" aria-label="Manage partners and listings">{Object.entries(sections).map(([key,label]) =>
      <Link key={key} href={'/admin/'+key} aria-current={key === operation ? 'page' : undefined}>{label}</Link>)}</nav>
    <CabScreen area="operations" screen="manage" id={operation} query={await searchParams}/></section>;
}
