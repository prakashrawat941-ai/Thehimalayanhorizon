import { ListingList, listingMeta } from '@/components/ListingPages';
export const generateMetadata = () => listingMeta('village_tour');
export default async function Page({ searchParams }) {
    return <ListingList kind="village_tour" sp={await searchParams}/>;
}
