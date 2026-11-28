'use client';
import { useState } from 'react';
import { Badge, Tabs, ToastProvider, UiIcon } from '@/components/ui/workspace';
import { notConnectedAdapter } from '@/lib/modules/core';
import { MODULES, NAV_LABEL_OVERRIDE, sectionsFor } from '@/lib/modules/modules';
import { COMMON, ROLE_LABEL, tr } from '@/lib/modules/labels';
import { WorkQueue } from '@/components/dash/management/WorkQueue';
import { NotificationSection } from './NotificationSection';
import { ApprovalSection } from './ApprovalSection';
import { TableSection } from './TableSection';
import {
  AttendanceSection, CalendarSection, ChatSection, EmergencySection, FormSection, IdCardSection, IntegrationsSection,
  LinksSection, LiveStatsSection, LiveTableSection, MatrixSection, PrefsSection, ReportsSection, ResearchSection,
  StatsSection, TimelineSection, TreeSection, WelcomeSection,
} from './Sections';

/**
 * One Step 02 module for one leadership role.
 *
 *   adapter: omitted on real routes → not connected (nothing shown or saved) until Codex's API exists.
 *            The sample-data review route passes a demo adapter and `sample` so every screen is labelled.
 *   live:    read-only data the server already loaded from existing management RPCs, per live section.
 *   me:      the signed-in person's display data (from the server session).
 *   decide:  the existing `decide` server action, for the live approval queue (approved WorkQueue component).
 */
export function ModuleWorkspace(props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}

function Inner({ role, moduleKey, lang = 'en', adapter = notConnectedAdapter, sample = false, live = {}, me = null, decide = null, initialTab }) {
  const t = tr(lang);
  const m = MODULES[moduleKey];
  const sections = sectionsFor(moduleKey, role);
  const [tab, setTab] = useState(initialTab && sections.some((s) => s.id === initialTab) ? initialTab : sections[0]?.id);
  if (!m || !sections.length) return null;
  const title = t(NAV_LABEL_OVERRIDE[role]?.[moduleKey] || m.title);
  const anyLive = sections.some((s) => s.type.startsWith('live') && live?.[s.live]?.connected);

  const render = (s) => {
    const common = { section: s, adapter, lang, me, role };
    switch (s.type) {
      case 'table': return !sample && s.entity === 'approval'
        ? <ApprovalSection key={s.id} role={role} scope={s.scope} lang={lang} create={!!s.create} statuses={s.statuses || null} showCounts />
        : <TableSection {...common} actorName={me?.name} />;
      case 'welcome': return <WelcomeSection {...common} />;
      case 'idcard': return <IdCardSection {...common} />;
      case 'form': return <FormSection {...common} />;
      case 'stats': return <StatsSection {...common} />;
      case 'timeline': return !sample && s.entity === 'notification'
        ? <NotificationSection inbox={live.inbox} role={role} lang={lang} />
        : <TimelineSection {...common} />;
      case 'calendar': return <CalendarSection {...common} />;
      case 'chat': return <ChatSection {...common} />;
      case 'integrations': return <IntegrationsSection {...common} />;
      case 'prefs': return <PrefsSection {...common} />;
      case 'matrix': return <MatrixSection {...common} />;
      case 'reports': return <ReportsSection {...common} />;
      case 'research': return <ResearchSection {...common} />;
      case 'attendance': return <AttendanceSection {...common} />;
      case 'emergency': return <EmergencySection {...common} />;
      case 'tree': return <TreeSection {...common} />;
      case 'live-table': return <LiveTableSection section={s} live={live} lang={lang} WorkQueueComponent={WorkQueue} decide={decide} />;
      case 'live-stats': return <LiveStatsSection section={s} live={live} lang={lang} />;
      default: return null;
    }
  };

  return (
    <div className="ui-module" data-surface="enterprise" data-module={moduleKey}>
      <div className="ds-head">
        <div className="grow">
          <p className="eyebrow">{t(ROLE_LABEL[role])}</p>
          <h1><UiIcon name={m.icon} size={22} /> {title}</h1>
          <p className="muted">{t(m.scope?.[role] || m.summary)}</p>
        </div>
        <div className="ui-mod-badges">
          {!sample && anyLive ? <Badge tone="success">{t(COMMON.live)}</Badge> : null}
          {!sample ? <Badge tone="neutral">{t(['Backend: in progress', 'बैकएंड: प्रगति पर'])}</Badge> : null}
        </div>
      </div>
      {sample ? <p className="ui-demo-banner" role="note"><Badge tone="warning">{t(COMMON.sample)}</Badge> {t(COMMON.sampleNote)}</p> : null}
      <LinksSection links={m.links?.[role]} lang={lang} />
      {sections.length > 1 ? (
        <Tabs label={title} value={tab} onChange={setTab} tabs={sections.map((s) => ({ id: s.id, label: t(s.title), content: <div className="ui-mod-panel">{render(s)}</div> }))} />
      ) : <div className="ui-mod-panel">{render(sections[0])}</div>}
    </div>
  );
}
