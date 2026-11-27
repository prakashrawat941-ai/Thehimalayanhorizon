'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/config';
import { isEmployeeId } from '@/lib/management/employee-id';
import { createClient } from '@/lib/supabase/server';

export async function signInWithEmployeeId(employeeId, password) {
  const invalid = { ok: false };
  if (typeof employeeId !== 'string' || typeof password !== 'string'
    || !isEmployeeId(employeeId) || password.length < 8 || password.length > 1024
    || !process.env.SUPABASE_SERVICE_ROLE_KEY) return invalid;

  const admin = createAdminClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: email, error: lookupError } = await admin.rpc('management_employee_login_email', {
    p_employee_id: employeeId,
  });
  if (lookupError || !email) return invalid;

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({
    email,
    password,
  });
  return { ok: !error };
}
