import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/config';
/** Supabase client that acts as the signed-in user (reads the auth cookies). */
export async function createClient() {
    const store = await cookies();
    return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (list) => {
                try {
                    list.forEach(({ name, value, options }) => store.set(name, value, options));
                }
                catch {
                    // Called from a Server Component: the middleware refreshes the session instead.
                }
            },
        },
    });
}
/** Anonymous client for public content (CMS, approved listings). No cookies, so pages stay cacheable. */
let publicClient = null;
export function publicDb() {
    if (!publicClient) {
        publicClient = createPlainClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return publicClient;
}
