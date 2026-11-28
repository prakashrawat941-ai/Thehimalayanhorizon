'use client';
import { useMemo, useState } from 'react';
import { AppShell, Badge } from '@/components/ui/workspace';
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace';
import { createDemoAdapter, NOT_CONNECTED } from '@/lib/modules/core';
import { ENTITIES } from '@/lib/modules/entities';
import { MODULES, NAV_LABEL_OVERRIDE, modulesFor } from '@/lib/modules/modules';
import { SAMPLE_CHAT, SAMPLE_HEALTH, SAMPLE_ME, sampleSeed } from '@/lib/modules/sample';

const ROLES = [['founder', 'Founder'], ['ceo', 'CEO'], ['co_founder', 'Co-Founder']];
const MATRIX = {
  roles: ['founder', 'ceo', 'co_founder'],
  permissions: [
    { key: 'approvals.final', label: 'Final approval (sample)', roles: ['founder'] },
    { key: 'approvals.review', label: 'Review Co-Founder changes (sample)', roles: ['ceo'] },
    { key: 'cms.edit', label: 'Edit website content (sample)', roles: ['co_founder'] },
    { key: 'people.manage', label: 'Manage employees (sample)', roles: ['founder', 'ceo'] },
    { key: 'finance.view', label: 'View finance (sample)', roles: ['founder'] },
  ],
};

/**
 * Demo adapter: the generic in-memory adapter plus a few read-only summaries. Integration status is
 * reported as not configured (true in every environment until Codex configures providers). PDF export and
 * QR verification stay unavailable even here, so the demo never shows a capability that does not exist.
 */
function demoAdapter(role) {
  const seed = { ...sampleSeed(), conversation: SAMPLE_CHAT.map((c) => ({ ...c })) };
  const base = createDemoAdapter(ENTITIES, seed);
  const ok = (data) => ({ success: true, data });
  return {
    ...base,
    async get(entity, id) {
      if (entity === 'health') return ok(SAMPLE_HEALTH);
      if (entity === 'integration_status') return ok({});
      if (entity === 'permissions') return ok(MATRIX);
      if (entity === 'report') {
        const key = String(id).split(':')[0];
        return ok({ columns: [{ key: 'item', label: 'Item' }, { key: 'value', label: 'Value' }], rows: [{ item: `${key} report`, value: 'sample' }] });
      }
      if (entity === 'report_pdf' || entity === 'id_verification') return NOT_CONNECTED;
      return base.get(entity, id);
    },
    async create(entity, values, meta) {
      if (entity === 'research_job') {
        return ok({ place: values.place, district: values.district, facts: [
          { id: 'f1', label: 'Altitude', value: 'about 1,500 m (sample)', source: 'https://example.org/sample-source-1' },
          { id: 'f2', label: 'Nearest town', value: 'Almora (sample)', source: 'https://example.org/sample-source-2' },
          { id: 'f3', label: 'Best season', value: 'March–June, Sept–Nov (sample)', source: null },
        ] });
      }
      if (entity === 'attendance_entry') return ok({ ...values, createdAt: new Date().toISOString() });
      if (entity.startsWith('form:') || ['notification_preferences', 'emergency_alert'].includes(entity)) return ok({ ...values });
      if (entity === 'approval') return base.create(entity, { requesterName: SAMPLE_ME[role].name, stage: 'ceo_review', changes: [], ...values }, meta);
      return base.create(entity, values, meta);
    },
  };
}

export function ModulesDemo() {
  const [role, setRole] = useState('founder');
  const [moduleKey, setModuleKey] = useState('profile');
  const [lang, setLang] = useState('en');
  const [resetKey, setResetKey] = useState(0);
  const adapter = useMemo(() => demoAdapter(role), [role, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const mods = modulesFor(role);
  const current = mods.includes(moduleKey) ? moduleKey : mods[0];
  const nav = mods.map((k) => ({ href: `#${k}`, label: (NAV_LABEL_OVERRIDE[role]?.[k] || MODULES[k].title)[lang === 'hi' ? 1 : 0], icon: MODULES[k].icon, current: k === current }));
  const LinkComponent = ({ href, children, ...rest }) => (
    <a href={href} {...rest} onClick={(e) => { e.preventDefault(); setModuleKey(href.slice(1)); }}>{children}</a>
  );
  return (
    <AppShell brand="THH leadership modules (sample)" nav={nav} LinkComponent={LinkComponent}>
      <div className="ui-demo-controls">
        <label className="ui-filter-select"><span className="ui-filter-label">Acting as</span>
          <select className="ui-input" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Acting as">
            {ROLES.map(([k, l]) => <option key={k} value={k}>{SAMPLE_ME[k].name} · {l}</option>)}
          </select>
        </label>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" aria-pressed={lang === 'hi'} onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>{lang === 'hi' ? 'English' : 'हिंदी'}</button>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setResetKey((k) => k + 1)}>Reset sample data</button>
        <Badge tone="warning">Sample data · nothing is saved</Badge>
      </div>
      <ModuleWorkspace key={`${role}-${current}-${resetKey}`} role={role} moduleKey={current} lang={lang} adapter={adapter} sample me={SAMPLE_ME[role]} />
    </AppShell>
  );
}
