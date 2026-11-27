import { AccountNav } from '@/components/account/AccountNav';
import { DashSwitcher } from './DashSwitcher';
import { authorisedDashboards, switcherItems } from '@/lib/dashboards';
import '@/app/dash.css';

/**
 * Shared dashboard frame: sidebar on laptops, scrollable section chips on phones, and the
 * dashboard switcher on top. `ctx` is the server session ({ roles }); `managementRole` must be
 * a server-verified role (see lib/dashboards.js). The route itself must still guard access.
 */
export function DashLayout({ ctx, managementRole = null, current, title, items, L, children }) {
  const keys = authorisedDashboards({ roles: ctx?.roles, managementRole });
  return (
    <div className="ds" data-surface="brand">
      <AccountNav items={items} title={title} />
      <div className="ds-main">
        <div className="dsx-topbar">
          <DashSwitcher current={current} items={switcherItems(keys, L)} labels={{
            switch: L('Switch dashboard', 'डैशबोर्ड बदलें'), yours: L('Your dashboards', 'आपके डैशबोर्ड'),
            note: L('Only dashboards you are allowed to open are listed. Each one checks your access again.', 'सिर्फ़ वही डैशबोर्ड दिखते हैं जिनकी आपको अनुमति है। हर डैशबोर्ड आपकी अनुमति दोबारा जाँचता है।'),
          }} />
        </div>
        {children}
      </div>
    </div>
  );
}
