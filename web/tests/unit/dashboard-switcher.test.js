import { describe, expect, it } from 'vitest';
import { authorisedDashboards, switcherItems } from '../../lib/dashboards.js';

describe('dashboard switcher visibility', () => {
  it('never offers a leadership dashboard for an Admin role alone', () => {
    expect(authorisedDashboards({ roles: { admin: true } })).toEqual(['admin', 'account']);
  });

  it('offers only the specifically verified management role and user account', () => {
    expect(authorisedDashboards({ managementRole: 'co_founder' })).toEqual(['co_founder', 'account']);
    expect(authorisedDashboards({ roles: { admin: true }, managementRole: 'ceo' })).toEqual(['ceo', 'admin', 'account']);
  });

  it('maps those entries to stable routes and localized labels', () => {
    const items = switcherItems(['founder', 'account'], (en, hi) => hi);
    expect(items.map(({ href, label }) => [href, label])).toEqual([
      ['/founder', 'संस्थापक'], ['/account', 'मेरा खाता'],
    ]);
  });
});
