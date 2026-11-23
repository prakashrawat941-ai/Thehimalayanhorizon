import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/data';
import { ComingSoon, PageHead } from './Blocks';
const TITLE = { 'our-story': 'our_story', about: 'about', 'our-office': 'our_office', privacy: 'privacy', terms: 'terms' };
async function load(key) {
    const [settings, tr] = await Promise.all([getSettings(), getT()]);
    const page = (settings.pages || {})[key];
    const title = (page && tr.pick(page, 'title')) || tr.t(TITLE[key]);
    const body = page ? tr.pick(page, 'body') : '';
    return { tr, title, body };
}
export async function infoMeta(key) {
    const { title, body } = await load(key);
    return { title, description: body ? body.slice(0, 160) : undefined, alternates: { canonical: `/${key}` }, robots: body ? undefined : { index: false } };
}
export async function InfoPage({ infoKey }) {
    const { tr, title, body } = await load(infoKey);
    return (<div className="page narrow">
      <PageHead title={title}/>
      {body ? <div className="prose">{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : <ComingSoon tr={tr}/>}
    </div>);
}
