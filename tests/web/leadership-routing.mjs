import assert from 'node:assert/strict';
import { leadershipDestination, LEADERSHIP_ROLES } from '../../web/lib/management/leadership.js';

// Correct dashboard per role, only with aal2.
assert.deepEqual(leadershipDestination({ role: 'founder', aal: 'aal2' }), { status: 'go', path: '/founder' });
assert.deepEqual(leadershipDestination({ role: 'ceo', aal: 'aal2' }), { status: 'go', path: '/ceo' });
assert.deepEqual(leadershipDestination({ role: 'co_founder', aal: 'aal2' }), { status: 'go', path: '/co-founder' });

// MFA enforcement: any other assurance level never reaches a dashboard.
for (const role of LEADERSHIP_ROLES) {
  for (const aal of ['aal1', null, undefined, '']) {
    assert.deepEqual(leadershipDestination({ role, aal }), { status: 'mfa' });
  }
}

// Unauthorized users: no membership, employee, unknown or odd role values, even at aal2.
for (const role of [null, undefined, '', 'employee', 'admin', 'Founder', 'ceo ', 'co-founder']) {
  assert.deepEqual(leadershipDestination({ role, aal: 'aal2' }), { status: 'denied' });
}

// Each role maps to a distinct workspace (no cross-role redirect).
const paths = LEADERSHIP_ROLES.map((role) => leadershipDestination({ role, aal: 'aal2' }).path);
assert.equal(new Set(paths).size, 3);
console.log('leadership routing: ok');
