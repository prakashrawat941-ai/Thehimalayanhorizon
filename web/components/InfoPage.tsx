import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/data';
import { ComingSoon, PageHead } from './Blocks';

// Text pages (Our Story, About, Office, Privacy, Terms) are edited by the admin in
// site_settings → key "pages": { "about": { "title", "title_hi", "body", "body_hi" }, ... }.
// Until the admin writes them, the page honestly says "Coming soon".
export type InfoKey = 'our-story' | 'about' | 'our-office' | 'privacy' | 'terms';
const TITLE: Record<InfoKey, string> = { 'our-story': 'our_story', about: 'about', 'our-office': 'our_office', privacy: 'privacy', terms: 'terms' };

async function load(key: InfoKey) {
  const [settings, tr] = await Promise.all([getSettings(), getT()]);
  const page = (settings.pages || {})[key] as Record<string, string> | undefined;
  const title = (page && tr.pick(page, 'title')) || tr.t(TITLE[key]);
  const body = page ? tr.pick(page, 'body') : '';
  return { tr, title, body };
}

export async function infoMeta(key: InfoKey): Promise<Metadata> {
  const { title, body } = await load(key);
  return { title, description: body ? body.slice(0, 160) : undefined, alternates: { canonical: `/${key}` }, robots: body ? undefined : { index: false } };
}

export async function InfoPage({ infoKey }: { infoKey: InfoKey }) {
  const { tr, title, body } = await load(infoKey);
  return (
    <div className="page narrow">
      <PageHead title={title} />
      {body ? <div className="prose">{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : <ComingSoon tr={tr} />}
    </div>
  );
}
