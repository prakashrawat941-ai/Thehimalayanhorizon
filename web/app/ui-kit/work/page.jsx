import { notFound } from 'next/navigation';
import { WorkDemo } from './WorkDemo';

export const metadata = { title: 'Work demo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Sample-data demo of the THH Work workspace. Hidden unless ENABLE_UI_KIT=1 and not production. Nothing is saved. */
export default function WorkDemoPage() {
  if (process.env.ENABLE_UI_KIT !== '1' || process.env.VERCEL_ENV === 'production') notFound();
  return <WorkDemo />;
}
