import { ListingList, listingMeta } from '@/components/ListingPages';
export const generateMetadata = () => listingMeta('workspace');
export default async function Page({ searchParams }) {
    return <ListingList kind="workspace" sp={await searchParams}/>;
}
