import { notFound } from 'next/navigation';
import { UiKitDemo } from './UiKitDemo';

export const metadata = { title: 'UI kit', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Developer-only component gallery. It renders sample data to exercise the components and is therefore
 * hidden unless ENABLE_UI_KIT=1 is set explicitly (local dev, CI, preview). It is never enabled in production.
 */
export default function UiKitPage() {
  if (process.env.ENABLE_UI_KIT !== '1' || process.env.VERCEL_ENV === 'production') notFound();
  return <UiKitDemo />;
}
