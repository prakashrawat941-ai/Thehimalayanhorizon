import { getT } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/management/guard';
import { loadFinance, loadManagementEvents, loadOffices, loadPeople, loadWork } from '@/lib/dash/management-live';
import { decide } from '@/app/management/dashboard-actions';
import { MODULE_PATH, ROLE_BASE, sectionsFor } from '@/lib/modules/modules';
import { ModuleWorkspace } from './ModuleWorkspace';

// Which existing management_work view each role's live approval queue uses (lib/dash/management-live.js).
const WORK_VIEW = { founder: 'founder', ceo: 'reviews', co_founder: null };

/**
 * Server entry for one Step 02 module page. Guards with the management guard (role + aal2), then loads
 * only the read-only live data this role's sections need from EXISTING management RPCs. All other
 * sections render "Not connected yet" until Codex ships their contract (docs/DATA-CONTRACTS.md).
 * No sample data is ever used here.
 */
export async function ModuleRoute({ role, moduleKey }) {
  const path = `${ROLE_BASE[role]}/${MODULE_PATH[moduleKey]}`;
  const { db, user, mfaNeeded } = await requireManagement(role, path);
  if (mfaNeeded) return null; // the layout shows the two-step verification screen
  const { lang } = await getT();

  const sections = sectionsFor(moduleKey, role);
  const wants = new Set(sections.filter((s) => s.live).map((s) => s.live));
  const live = {};
  const jobs = [];
  if (wants.has('work')) jobs.push(loadWork(db, role, user.id, WORK_VIEW[role]).then((r) => { live.work = { connected: !r.error, rows: r.data || [] }; }));
  if (wants.has('people')) jobs.push(loadPeople(db).then((r) => { live.people = { connected: !r.error, rows: (r.data || []).map((p) => ({ ...p, id: p.userId })) }; }));
  if (wants.has('events')) jobs.push(loadManagementEvents(db).then((r) => { live.events = { connected: !r.error, rows: r.data || [] }; }));
  if (wants.has('offices')) jobs.push(loadOffices(db).then((r) => { live.offices = { connected: !r.error, rows: r.data || [] }; }));
  if (wants.has('finance')) jobs.push(loadFinance(db).then((r) => { live.finance = { connected: !r.error, rows: r.data || null }; }));

  const meJob = db.from('management_members').select('display_name,office').eq('user_id', user.id).maybeSingle()
    .then(({ data }) => data || {}, () => ({}));
  const [member] = await Promise.all([meJob, ...jobs]);

  const me = {
    name: member.display_name || user.user_metadata?.full_name || user.email || null,
    office: member.office || null,
    designation: null, // set by an appointment once the People contract exists
    employeeId: null, // issued by the server once the employee ID contract exists
  };

  return <ModuleWorkspace role={role} moduleKey={moduleKey} lang={lang} live={live} me={me} decide={decide} />;
}
