import { InfoPage, infoMeta } from '@/components/InfoPage';

export const generateMetadata = () => infoMeta('our-story');

export default function Page() {
  return <InfoPage infoKey="our-story" />;
}
