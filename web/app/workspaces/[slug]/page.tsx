import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  return listingDetailMeta('workspace', (await params).slug);
}

export default async function Page({ params }: { params: Params }) {
  return <ListingDetail kind="workspace" slug={(await params).slug} />;
}
