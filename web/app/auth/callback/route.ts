import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

// Google sign-in, email confirmation and password-reset links all come back here.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const errorText = url.searchParams.get('error_description') || url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (errorText) return back(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(errorText)}`);
  if (!code) return back(`/login?next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`);

  // Google sign-in: fill an empty profile name/photo from the Google account (only empty fields).
  const u = data.user;
  if (u) {
    const meta = (u.user_metadata || {}) as Record<string, string>;
    const { data: p } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', u.id).maybeSingle();
    if (p) {
      const patch: Record<string, string> = {};
      const photo = meta.avatar_url || meta.picture || '';
      const name = meta.full_name || meta.name || '';
      if (!p.avatar_url && photo) patch.avatar_url = photo.slice(0, 500);
      if (!p.full_name && name) patch.full_name = name.slice(0, 120);
      if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', u.id);
    }
  }
  return back(next);
}
