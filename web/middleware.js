import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/config';
// Pages that need a signed-in user. Others are public.
const PROTECTED = ['/account', '/trips', '/partner', '/admin', '/drive','/management','/employee','/co-founder','/founder','/ceo'];
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
    if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
        return NextResponse.redirect(url);
    }
    return response;
}
export const config = {
    matcher: ['/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|img/|favicon|robots.txt|sitemap.xml).*)'],
};
