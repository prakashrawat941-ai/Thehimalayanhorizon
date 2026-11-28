import { ModuleRoute } from '@/components/modules/ModuleRoute';

export const metadata = { robots: { index: false } };

// Step 02 module page. Guarded by requireManagement inside ModuleRoute; no sample data on this route.
export default function Page() {
  return <ModuleRoute role="co_founder" moduleKey="control" />;
}
