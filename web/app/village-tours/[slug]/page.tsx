import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  return listingDetailMeta('village_tour', (await params).slug);
}

export default async function Page({ params }: { params: Params }) {
  return <ListingDetail kind="village_tour" slug={(await params).slug} />;
}
