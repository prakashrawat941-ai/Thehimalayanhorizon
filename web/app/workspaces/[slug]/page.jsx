import { ListingDetail, listingDetailMeta } from '@/components/ListingPages';
export async function generateMetadata({ params }) {
    return listingDetailMeta('workspace', (await params).slug);
}
export default async function Page({ params }) {
    return <ListingDetail kind="workspace" slug={(await params).slug}/>;
}
