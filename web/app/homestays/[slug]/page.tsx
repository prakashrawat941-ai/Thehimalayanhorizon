import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  return listingDetailMeta('homestay', (await params).slug);
}

export default async function Page({ params }: { params: Params }) {
  return <ListingDetail kind="homestay" slug={(await params).slug} />;
}
