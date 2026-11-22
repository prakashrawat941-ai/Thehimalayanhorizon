import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { LEGACY_APP } from '@/lib/config';
import { Icon } from '@/components/Icon';

export const metadata = { robots: { index: false } };

export default async function AccountPage() {
  const { user, profile, roles } = await getSession();
  if (!user || !roles) redirect('/login?next=/account');
  const { t, L } = await getT();
  const name = profile?.full_name || user.email || '';
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '🙂';
  const roleChips = [roles.customer && t('role_customer'), roles.partner && t('role_partner'), roles.driver && t('role_driver'), roles.admin && t('role_admin')].filter(Boolean) as string[];
  const links: [string, string, string][] = [
    ['account', 'calendar', t('my_bookings')], ['trips', 'map', t('my_trips')], ['account/notifications', 'bell', t('notifications')], ['account/profile', 'user', t('profile')],
  ];
  return (
    <div className="page">
      <div className="account-head">
        {profile?.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="avatar" src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
          : <span className="avatar">{initials}</span>}
        <div className="grow">
          <p className="eyebrow">{t('signed_in_as')}</p>
          <h1>{name}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm"><Icon name="logout" size={16} /> {t('signout')}</button></form>
      </div>
      <section className="section">
        <h2>{t('your_roles')}</h2>
        <div className="chips">{roleChips.map((r) => <span className="chip" key={r}>{r}</span>)}</div>
        <div className="row-actions mt">
          {roles.partner ? <Link className="btn btn-ghost" href="/partner">{t('partner')}</Link> : <Link className="btn btn-ghost" href="/partner/join">{t('become_partner')}</Link>}
          {roles.admin ? <Link className="btn btn-ghost" href="/admin">{t('admin')}</Link> : null}
        </div>
      </section>
      <section className="section">
        <div className="soft-note">{L('Your full dashboard is being moved to the new site (Part 3). For now these open in the current app with the same login:',
          'आपका पूरा डैशबोर्ड नई वेबसाइट पर आ रहा है (Part 3)। अभी ये मौजूदा ऐप में उसी लॉगिन से खुलेंगे:')}</div>
        <div className="grid grid-4">
          {links.map(([path, ic, label]) => (
            <a key={path} className="card" href={LEGACY_APP + path} style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name={ic} size={22} /> <strong>{label}</strong>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
