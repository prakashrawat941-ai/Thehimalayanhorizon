import { ListingList, listingMeta } from '@/components/ListingPages';

export const generateMetadata = () => listingMeta('homestay');

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ListingList kind="homestay" sp={await searchParams} />;
}
