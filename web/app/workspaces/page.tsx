import { ListingList, listingMeta } from '@/components/ListingPages';

export const generateMetadata = () => listingMeta('workspace');

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ListingList kind="workspace" sp={await searchParams} />;
}
