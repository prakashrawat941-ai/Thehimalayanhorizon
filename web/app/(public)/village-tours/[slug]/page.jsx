import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';
export async function generateMetadata({ params }) {
    return listingDetailMeta('village_tour', (await params).slug);
}
export default async function Page({ params }) {
    return <ListingDetail kind="village_tour" slug={(await params).slug}/>;
}
