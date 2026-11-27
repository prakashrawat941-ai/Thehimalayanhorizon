import { decisions } from '@/lib/management/catalog';
import { istDayRange } from './management-data';

function check(result) { if (result.error) throw result.error; return result.data ?? []; }
const outcome = async (fn) => { try { return { data: await fn(), error: false }; } catch (e) { console.error('[management dashboard]', e?.message); return { data: null, error: true }; } };
export const loadFinance = (db) => outcome(async () => check(await db.rpc('management_finance'))[0] || { booking_value: 0, commission: 0 });
export const loadPeople = (db) => outcome(async () => {
  const [people, ids] = await Promise.all([db.rpc('management_people'), db.rpc('management_leadership_employee_ids')]);
  const byUser = new Map(check(ids).map(({ user_id, employee_id }) => [user_id, employee_id]));
  return check(people).map((p) => ({
    userId: p.user_id, name: p.display_name, role: p.role, office: p.office, mfa: p.mfa,
    employeeId: byUser.get(p.user_id),
    lastActive: p.last_active ? new Date(p.last_active).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
  }));
});
export const loadWork = (db, member, userId, view) => outcome(async () => {
  const actionsFirst = ['founder', 'tasks', 'reviews'].includes(view);
  const query = () => {
    let q = db.from('management_work').select('id,kind,subject,owner_id,assignee,amount,status,created_at,management_events(action,note,happened_at)');
    if (view === 'founder') q = q.in('kind', ['critical','finance','expense']);
    if (view === 'tasks') q = q.in('kind', ['task','email','operation']);
    if (view === 'reviews') q = q.in('kind', ['partner','cms','release']);
    if (view === 'requests') q = q.in('kind', ['critical','finance']).eq('owner_id', userId);
    if (view === 'releases') q = q.eq('kind', 'release').eq('owner_id', userId);
    return q.order('created_at', { ascending: false }).order('id', { ascending: false });
  };
  const rows = [];
  if (actionsFirst) {
    const size = 100;
    for (let from = 0; ; from += size) {
      const page = check(await query().eq('status', 'open').range(from, from + size - 1));
      rows.push(...page);
      if (page.length < size) break;
    }
    rows.push(...check(await query().neq('status', 'open').limit(100)));
  } else {
    rows.push(...check(await query().limit(100)));
  }
  return rows.map((w) => ({ id: w.id, kind: w.kind, subject: w.subject, from: w.owner_id === userId ? null : w.owner_id.slice(0,8), amount: w.amount, when: new Date(w.created_at).toLocaleString('en-IN', { timeZone:'Asia/Kolkata' }), status: w.status, actions: decisions(member,userId,w) }));
});
export const loadOffices = (db) => outcome(async () => {
  const [staff, attendance] = await Promise.all([
    db.from('management_members').select('user_id,display_name,office').eq('role','employee'),
    db.from('management_work').select('owner_id,created_at').eq('kind','attendance').gte('created_at',istDayRange()[0]).lt('created_at',istDayRange()[1]),
  ]);
  return check(staff).map((m) => ({ id: m.user_id, name: m.display_name || m.office, status: check(attendance).some((a) => a.owner_id === m.user_id) ? 'in' : 'out', sub: m.office }));
});

export const loadManagementEvents = (db) => outcome(async () => {
 const events=check(await db.from('management_events').select('id,work_id,actor,action,note,happened_at,management_work(kind,subject)').order('happened_at',{ascending:false}).limit(30));
 return events.map((e)=>({id:`management-${e.id}`,actorName:e.actor?.slice(0,8),action:e.action,table_name:e.management_work?.kind||'management',subject:e.management_work?.subject,created_at:e.happened_at}));
});
