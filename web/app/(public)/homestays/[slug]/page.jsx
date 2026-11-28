import { listingDetailMeta } from '@/components/ListingPages';
import { StayDetail } from '@/components/stay/StayDetail';
export async function generateMetadata({ params }) {
    return listingDetailMeta('homestay', (await params).slug);
}
export default async function Page({ params }) {
    return <StayDetail slug={(await params).slug}/>;
}
