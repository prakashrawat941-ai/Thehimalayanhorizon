// SAMPLE DATA for the demo route only (/ui-kit/work). It is never shown on a management dashboard
// and it is never saved. Names are fictional.
export const SAMPLE_PEOPLE = Object.freeze({
  'THH-EMP-0001': { id: 'THH-EMP-0001', name: 'Sample Founder', role: 'Founder' },
  'THH-EMP-0002': { id: 'THH-EMP-0002', name: 'Sample CEO', role: 'CEO' },
  'THH-EMP-0003': { id: 'THH-EMP-0003', name: 'Sample Co-Founder', role: 'Co-Founder' },
});

export function sampleTasks() {
  const h = (at, actorId, action, from, to, note = '') => ({ at, actorId, action, from, to, note });
  const t1 = '2026-11-20T04:00:00.000Z';
  return [
    {
      id: 'THH-TSK-000001', title: 'Sample: Review homestay checklist', description: 'Sample description for the demo.',
      creatorId: 'THH-EMP-0001', assigneeId: 'THH-EMP-0002', reviewerId: 'THH-EMP-0001', reviewRequired: true,
      departmentId: null, priority: 'high', startDate: '2026-11-18', dueDate: '2026-11-25', estimateHours: 6,
      progress: 100, status: 'submitted', version: 5, createdAt: t1, updatedAt: '2026-11-24T06:00:00.000Z',
      history: [
        h(t1, 'THH-EMP-0001', 'create', null, 'assigned'),
        h('2026-11-19T04:00:00.000Z', 'THH-EMP-0002', 'accept', 'assigned', 'accepted'),
        h('2026-11-19T05:00:00.000Z', 'THH-EMP-0002', 'start', 'accepted', 'in_progress'),
        h('2026-11-24T06:00:00.000Z', 'THH-EMP-0002', 'submit', 'in_progress', 'submitted', 'Checklist attached (sample)'),
      ],
    },
    {
      id: 'THH-TSK-000002', title: 'Sample: Update Hindi copy on Our Story page', description: '', projectId: 'THH-PRJ-00001', collaboratorIds: ['THH-EMP-0001'],
      creatorId: 'THH-EMP-0001', assigneeId: 'THH-EMP-0003', reviewerId: 'THH-EMP-0002', reviewRequired: true,
      departmentId: null, priority: 'medium', startDate: '2026-11-22', dueDate: '2026-12-02', estimateHours: 4,
      progress: 40, status: 'in_progress', version: 3, createdAt: t1, updatedAt: '2026-11-25T03:00:00.000Z',
      history: [
        h(t1, 'THH-EMP-0001', 'create', null, 'assigned'),
        h('2026-11-22T04:00:00.000Z', 'THH-EMP-0003', 'accept', 'assigned', 'accepted'),
        h('2026-11-22T05:00:00.000Z', 'THH-EMP-0003', 'start', 'accepted', 'in_progress'),
      ],
    },
    {
      id: 'THH-TSK-000003', title: 'Sample: Plan Surmoli office duty roster', description: '',
      creatorId: 'THH-EMP-0001', assigneeId: 'THH-EMP-0002', reviewerId: null, reviewRequired: false,
      departmentId: null, priority: 'urgent', startDate: '2026-11-28', dueDate: '2026-11-27', estimateHours: 2,
      progress: 0, status: 'assigned', version: 1, createdAt: t1, updatedAt: t1,
      history: [h(t1, 'THH-EMP-0001', 'create', null, 'assigned')],
    },
    {
      id: 'THH-TSK-000004', title: 'Sample: Old banner rotation', description: '',
      creatorId: 'THH-EMP-0003', assigneeId: 'THH-EMP-0003', reviewerId: null, reviewRequired: false,
      departmentId: null, priority: 'low', startDate: null, dueDate: null, estimateHours: null,
      progress: 0, status: 'cancelled', version: 2, createdAt: t1, updatedAt: '2026-11-21T03:00:00.000Z',
      history: [
        h(t1, 'THH-EMP-0003', 'create', null, 'assigned'),
        h('2026-11-21T03:00:00.000Z', 'THH-EMP-0003', 'cancel', 'assigned', 'cancelled', 'Replaced by a new banner plan'),
      ],
    },
  ];
}

export const SAMPLE_PROJECTS = Object.freeze([
  { id: 'THH-PRJ-00001', name: 'Sample: Winter season website refresh', ownerId: 'THH-EMP-0003', due: '2026-12-15', milestones: [
    { id: 'THH-MST-00101', title: 'Hindi copy reviewed', done: false },
    { id: 'THH-MST-00102', title: 'Winter hero approved by CEO', done: false },
  ] },
]);
