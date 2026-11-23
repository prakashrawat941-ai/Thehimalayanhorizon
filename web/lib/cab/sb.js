import { browserDb } from '@/lib/supabase/client';
export const sb = browserDb();
// Run a query and throw a readable error instead of returning { error }.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || 'Something went wrong');
  return data;
}

