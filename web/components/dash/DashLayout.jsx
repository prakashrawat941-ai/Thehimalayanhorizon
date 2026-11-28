import { AccountNav } from '@/components/account/AccountNav';
import { DashSwitcher } from './DashSwitcher';
import { authorisedDashboards, switcherItems } from '@/lib/dashboards';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { LangToggle } from '@/components/LangToggle';
import { Icon } from '@/components/Icon';
import { getT } from '@/lib/i18n/server';
import '@/app/dash.css';

/**
 * Shared dashboard frame: sidebar on laptops, scrollable section chips on phones, and the
 * dashboard switcher on top. `ctx` is the server session ({ roles }); `managementRole` must be
 * a server-verified role (see lib/dashboards.js). The route itself must still guard access.
 */
export async function DashLayout({ ctx, managementRole = null, current, title, items, L, children }) {
  const { lang, t } = await getT();
  const keys = authorisedDashboards({ roles: ctx?.roles, managementRole });
  const inbox = items.find(({ href }) => href?.endsWith('/notifications'));
  return (
    <div className="ds ds-management">
      <AccountNav items={items} title={title} />
      <div className="ds-main">
        <div className="dsx-topbar">
          <DashSwitcher current={current} items={switcherItems(keys, L)} labels={{
            switch: L('Switch dashboard', 'डैशबोर्ड बदलें'), yours: L('Your dashboards', 'आपके डैशबोर्ड'),
            note: L('Only dashboards you are allowed to open are listed. Each one checks your access again.', 'सिर्फ़ वही डैशबोर्ड दिखते हैं जिनकी आपको अनुमति है। हर डैशबोर्ड आपकी अनुमति दोबारा जाँचता है।'),
          }} />
          {managementRole && inbox ? <NotificationBell href={inbox.href} label={t('notifications')} /> : null}
          <LangToggle lang={lang} signedIn={Boolean(ctx?.user)} />
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost btn-sm" type="submit"><Icon name="logout" size={16} /> {t('signout')}</button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
