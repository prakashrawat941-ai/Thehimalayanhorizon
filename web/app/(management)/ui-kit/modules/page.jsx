import { notFound } from 'next/navigation';
import { ModulesDemo } from './ModulesDemo';

export const metadata = { title: 'Leadership modules demo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Sample-data review of every Step 02 module. Hidden unless ENABLE_UI_KIT=1 and not production. Nothing is saved. */
export default function ModulesDemoPage() {
  if (process.env.ENABLE_UI_KIT !== '1' || process.env.VERCEL_ENV === 'production') notFound();
  return <ModulesDemo />;
}
