import { InfoPage, infoMeta } from '@/components/InfoPage';

export const generateMetadata = () => infoMeta('our-office');

export default function Page() {
  return <InfoPage infoKey="our-office" />;
}
