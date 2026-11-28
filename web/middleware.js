import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/config';
// Pages that need a signed-in user. Others are public.
const PROTECTED = ['/account', '/trips', '/partner', '/admin', '/drive', '/founder', '/ceo', '/co-founder', '/employee', '/management'];
export async function middleware(request) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (list) => {
                list.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
        },
    });
    // Refreshes the session cookie when needed. Do not remove.
    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;
    if (PROTECTED.some((p) => path === p || path.startsWith(p + '/')) || path.startsWith('/leadership')) {
        response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    }
    if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
        const redirect = NextResponse.redirect(url);
        redirect.headers.set('Cache-Control', 'private, no-store, max-age=0');
        return redirect;
    }
    return response;
}
export const config = {
    matcher: ['/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|img/|favicon|robots.txt|sitemap.xml).*)'],
};
