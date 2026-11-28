import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITIES, OPTIONS } from '../lib/modules/entities.js';
import { FORMS, MODULES, MODULE_PATH, NAV_ICON, PROVIDERS, ROLE_BASE, ROLE_MODULES, moduleHref, moduleNav, modulesFor, sectionsFor } from '../lib/modules/modules.js';
import { STATUS } from '../lib/modules/labels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const pair = (p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'string' && x.trim().length > 0);
const LEGACY_ICONS = ['car', 'map', 'mountain', 'home', 'user', 'search', 'arrow', 'wifi', 'leaf', 'people', 'desk', 'shield', 'house', 'globe', 'calendar', 'route', 'star', 'support', 'bell', 'doc', 'heart', 'pin', 'plus', 'check', 'alert', 'layers', 'camera', 'logout', 'phone', 'mail', 'locate', 'sun'];
const ROLES = ['founder', 'ceo', 'co_founder'];
const SECTION_TYPES = ['table', 'form', 'stats', 'timeline', 'calendar', 'idcard', 'welcome', 'chat', 'integrations', 'prefs', 'matrix', 'reports', 'research', 'attendance', 'emergency', 'tree', 'live-table', 'live-stats'];
const LIVE = ['work', 'people', 'events', 'offices', 'finance'];

describe('module registry', () => {
  it('every module has bilingual title and summary, and a route segment', () => {
    for (const [k, m] of Object.entries(MODULES)) {
      expect(pair(m.title), k).toBe(true);
      expect(pair(m.summary), k).toBe(true);
      expect(MODULE_PATH[k], k).toBeTruthy();
      expect(m.codex?.length, `${k} lists its Codex needs`).toBeGreaterThan(0);
    }
  });

  it('every section is valid and its entity, form and live source exist', () => {
    for (const [k, m] of Object.entries(MODULES)) {
      for (const s of m.sections) {
        expect(SECTION_TYPES, `${k}.${s.id}`).toContain(s.type);
        expect(pair(s.title), `${k}.${s.id} title`).toBe(true);
        if (s.type === 'table' || s.type === 'timeline' || s.type === 'tree' || s.type === 'calendar') expect(ENTITIES[s.entity], `${k}.${s.id} entity ${s.entity}`).toBeTruthy();
        if (s.type === 'form') expect(FORMS[s.form], `${k}.${s.id} form`).toBeTruthy();
        if (s.live) expect(LIVE).toContain(s.live);
        if (s.create) expect(ENTITIES[s.entity].form, `${k}.${s.id} create form`).toBeTruthy();
        if (s.providers) for (const p of s.providers) expect(PROVIDERS.some((x) => x.key === p)).toBe(true);
      }
      for (const [role, ids] of Object.entries(m.roles)) {
        expect(ROLES).toContain(role);
        for (const id of ids) expect(m.sections.some((s) => s.id === id), `${k}.${role}.${id}`).toBe(true);
      }
    }
  });

  it('every entity column, filter, form and action is complete and bilingual', () => {
    for (const [name, e] of Object.entries(ENTITIES)) {
      expect(e.columns?.length, name).toBeGreaterThan(0);
      for (const c of e.columns) {
        expect(pair(c.label), `${name}.${c.key}`).toBe(true);
        if (c.kind === 'option') expect(OPTIONS[c.options] || Array.isArray(c.options), `${name}.${c.key} options`).toBeTruthy();
      }
      for (const f of e.filters || []) expect(e.columns.some((c) => c.key === f) || f === 'read', `${name} filter ${f}`).toBe(true);
      for (const f of e.form?.fields || []) {
        expect(pair(f.label), `${name}.form.${f.key}`).toBe(true);
        if (f.type === 'select') expect(f.options.length, `${name}.form.${f.key}`).toBeGreaterThan(0);
      }
      for (const [k, a] of Object.entries(e.actions || {})) {
        expect(pair(a.label), `${name}.action.${k}`).toBe(true);
        for (const st of [...(a.from || []), a.to].filter(Boolean)) expect(STATUS[st], `${name}.${k} status ${st} has a label`).toBeTruthy();
      }
      if (e.initialStatus) expect(STATUS[e.initialStatus], `${name} initial status`).toBeTruthy();
    }
  });

  it('every option label is bilingual', () => {
    for (const [k, list] of Object.entries(OPTIONS)) for (const o of list) expect(pair(o.label), `${k}.${o.value}`).toBe(true);
  });

  it('every role/module pair has a guarded route page', () => {
    for (const role of ROLES) {
      for (const k of modulesFor(role)) {
        const file = path.join(web, 'app', ROLE_BASE[role].slice(1), MODULE_PATH[k], 'page.jsx');
        expect(fs.existsSync(file), file).toBe(true);
        const src = fs.readFileSync(file, 'utf8');
        expect(src).toContain(`role="${role}"`);
        expect(src).toContain(`moduleKey="${k}"`);
        expect(src).not.toMatch(/import[^\n]*sample/i);
      }
    }
  });

  it('module routes never import sample data', () => {
    const route = fs.readFileSync(path.join(web, 'components/modules/ModuleRoute.jsx'), 'utf8');
    const ws = fs.readFileSync(path.join(web, 'components/modules/ModuleWorkspace.jsx'), 'utf8');
    expect(route).not.toMatch(/lib\/modules\/sample|sample-tasks/);
    expect(ws).not.toMatch(/lib\/modules\/sample|sample-tasks/);
    expect(route).toContain('requireManagement');
  });

  it('Work pages use the management guard, not the temporary admin guard', () => {
    for (const r of ['founder', 'ceo', 'co-founder']) {
      const src = fs.readFileSync(path.join(web, 'app', r, 'work', 'page.jsx'), 'utf8');
      expect(src).toContain('requireManagement');
      expect(src).not.toContain('requireAdmin');
      expect(src).toContain('source={null}');
    }
  });

  it('nav uses icons the existing sidebar can draw, and has a heading', () => {
    for (const k of Object.keys(MODULES)) expect(LEGACY_ICONS, k).toContain(NAV_ICON[k]);
    const L = (en) => en;
    for (const role of ROLES) {
      const nav = moduleNav(role, L);
      expect(nav[0]).toEqual({ heading: 'Company tools' });
      expect(nav.slice(1).map((i) => i.href)).toEqual(modulesFor(role).map((k) => moduleHref(role, k)));
    }
  });

  it('roles see the brief\'s required modules', () => {
    expect(modulesFor('founder')).toEqual(expect.arrayContaining(['profile', 'approvals', 'people', 'capital', 'strategy', 'control', 'activity']));
    expect(modulesFor('ceo')).toEqual(expect.arrayContaining(['profile', 'approvals', 'people', 'workforce', 'operations', 'village', 'connect']));
    expect(modulesFor('co_founder')).toEqual(expect.arrayContaining(['profile', 'approvals', 'destinations', 'partners', 'growth', 'control']));
    expect(modulesFor('co_founder')).not.toContain('capital');
    expect(sectionsFor('control', 'co_founder').map((s) => s.id)).not.toContain('suspend');
    expect(sectionsFor('approvals', 'co_founder').map((s) => s.id)).not.toContain('inbox');
  });

  it('ROLE_MODULES only lists modules the role is configured for', () => {
    for (const role of ROLES) for (const k of ROLE_MODULES[role]) expect(MODULES[k].roles[role], `${role}/${k}`).toBeTruthy();
  });
});
