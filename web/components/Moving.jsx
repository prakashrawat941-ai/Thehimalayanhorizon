import { getT } from '@/lib/i18n/server';
import { LEGACY_APP } from '@/lib/config';
import { Icon } from './Icon';
/** Honest placeholder for screens that are not rebuilt in Next.js yet: they open in the current live app. */
export async function Moving({ title, legacyPath, part }) {
    const { t, L } = await getT();
    return (<div className="page">
      <div className="moving empty-state">
        <span className="empty-ico"><Icon name="route" size={26}/></span>
        <p className="eyebrow">{L(`Next.js rebuild · ${part}`, `Next.js नई वेबसाइट · ${part}`)}</p>
        <h1>{title}</h1>
        <p className="muted">{t('moving_text')}</p>
        <a className="btn btn-lg" href={LEGACY_APP + legacyPath}>{t('open_current_app')} <Icon name="arrow" size={16}/></a>
      </div>
    </div>);
}
