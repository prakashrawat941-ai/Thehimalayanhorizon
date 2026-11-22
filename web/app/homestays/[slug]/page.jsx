import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';
export async function generateMetadata({ params }) {
    return listingDetailMeta('homestay', (await params).slug);
}
export default async function Page({ params }) {
    return <ListingDetail kind="homestay" slug={(await params).slug}/>;
}
