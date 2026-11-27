'use client';
import { useState } from 'react';
import { AppShell, PageHeader, Badge } from '@/components/ui';
import { WorkWorkspace } from '@/components/work/WorkWorkspace';
import { SAMPLE_PEOPLE, sampleTasks } from '@/lib/work/sample-tasks';

const PEOPLE = Object.values(SAMPLE_PEOPLE).map((p) => ({ id: p.id, name: p.name, role: p.role }));
const NAV = [{ href: '/ui-kit/work', label: 'Work demo', icon: 'check', current: true }];

/** Demo: pick who is acting, to see each dashboard's view of the same tasks. Changes are kept in memory only. */
export function WorkDemo() {
  const [actorId, setActorId] = useState('THH-EMP-0001');
  const [lang, setLang] = useState('en');
  const [seed, setSeed] = useState(() => sampleTasks());
  const actor = PEOPLE.find((p) => p.id === actorId);
  return (
    <AppShell brand="THH Work demo" nav={NAV}>
      <PageHeader
        title="THH Work: sample workspace"
        description="Sample data only. Use this to review the flow. Nothing is saved to the database."
        actions={(
          <label className="ui-filter-select">
            <span className="ui-filter-label">Acting as</span>
            <select className="ui-input" value={actorId} onChange={(e) => setActorId(e.target.value)}>
              {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
            </select>
          </label>
        )}
      />
      <p>
        <Badge tone="info">Acting as {actor?.role}</Badge>{' '}
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" aria-pressed={lang === 'hi'} onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
          {lang === 'hi' ? 'English' : 'हिंदी'}
        </button>
      </p>
      <div style={{ height: 12 }} />
      <WorkWorkspace
        lang={lang}
        source="demo"
        people={PEOPLE}
        actor={actor}
        initialTasks={seed}
        roleTitle={`THH Work · ${actor?.role}`}
      />
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setSeed(sampleTasks())}>Reset sample data</button>
    </AppShell>
  );
}
