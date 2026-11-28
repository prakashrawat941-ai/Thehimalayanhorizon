// Dashboard registry for the switcher. UI only: every dashboard route still checks the
// signed-in user's rights on the server.
export const DASHBOARDS = Object.freeze({
  founder: { href: '/founder', label: ['Founder', 'संस्थापक'], initials: 'F', color: '#1f4d3a' },
  ceo: { href: '/ceo', label: ['CEO', 'मुख्य कार्यकारी'], initials: 'C', color: '#1d5f99' },
  co_founder: { href: '/co-founder', label: ['Co-founder', 'सह-संस्थापक'], initials: 'CF', color: '#534AB7' },
  admin: { href: '/admin', label: ['Admin', 'एडमिन'], initials: 'A', color: '#9a5b00' },
  employee: { href: '/employee', label: ['Employee workspace', 'कर्मचारी कार्यक्षेत्र'], initials: 'E', color: '#166976' },
  account: { href: '/account', label: ['My account', 'मेरा खाता'], initials: 'ME', color: '#6b7680', sub: ['Bookings and trips', 'बुकिंग और यात्राएँ'] },
});

// Admin membership alone does not grant leadership access.
export const ADMIN_OPENS_MANAGEMENT = false;

/**
 * Keys of the dashboards this user may open, in display order.
 * `managementRole` must come from a server-side, MFA-checked read of management_members
 * and the Admin entry uses the separately granted profile role.
 */
export function authorisedDashboards({ roles = {}, managementRole = null } = {}) {
  const keys = [];
  if (managementRole && DASHBOARDS[managementRole]) keys.push(managementRole);
  if (roles?.admin && ADMIN_OPENS_MANAGEMENT) ['founder', 'ceo', 'co_founder'].forEach((k) => { if (!keys.includes(k)) keys.push(k); });
  if (roles?.admin) keys.push('admin');
  keys.push('account');
  return keys;
}

/** Plain, serialisable items for the client switcher. */
export function switcherItems(keys, L) {
  return keys.map((k) => {
    const d = DASHBOARDS[k];
    return { key: k, href: d.href, label: L(...d.label), sub: d.sub ? L(...d.sub) : d.href, initials: d.initials, color: d.color };
  });
}
