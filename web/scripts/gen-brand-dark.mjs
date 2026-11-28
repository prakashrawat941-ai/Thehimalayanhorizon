// Generates styles/brand-dark.generated.css: dark-theme overrides for the hard-coded light colours in
// the approved brand stylesheets (dashboards, guest account, partner portal and a small allow-list of
// shared primitives in globals.css). Overrides apply only on pages that contain a [data-surface] wrapper.
//
//   node scripts/gen-brand-dark.mjs          rewrite the file
//   node scripts/gen-brand-dark.mjs --check  exit 1 when the committed file is out of date
//
// Only declarations whose colour changes are emitted; nothing in the source CSS is edited.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('../styles/brand-dark.generated.css', import.meta.url));

export const SOURCES = [
  { file: 'app/dash.css' },
  { file: 'app/account/account.css' },
  { file: 'app/partner/partner.css' },
  {
    file: 'app/globals.css',
    // Shared primitives and chrome that appear on dashboard pages. Public-only blocks are left alone.
    allow: /^\.(btn|btn-ghost|btn-gold|btn-light|btn-danger-ghost|input|badge|badge-[a-z]+|pill|pill-[a-z]+|chip|chip-btn|empty|error-box|form-ok|modal|modal-head|topbar|menu|menu-item|ds-[a-z]+|toast|table-wrap|tabs|seg|seg-tabs|soft-note|success|stat|update-bar|avatar|icon-btn|icon-link|count|bell-dot|stepper|spinner|timeline|tl-dot|switch-row|warn-text|ok-t|bad-t)\b|^(select|textarea|input)\b|^body$/,
  },
];

const BG = {
  '#ffffff': '#161e1a', '#fffaf0': '#1a231f', '#faf7f0': '#1a231f', '#fffbf3': '#1f261d', '#fbf8f1': '#1a231f',
  '#f3eee3': '#222b27', '#f6faff': '#14202b', '#eeeae0': '#27332d', '#e3ddd0': '#33413a', '#eaf2fa': '#14283a',
  '#fdecea': '#3a1d1a', '#e3f1e8': '#173326', '#e7f2ec': '#173326', '#fdf1dc': '#3a2c12', '#eef1f3': '#222b27',
  '#eeedfe': '#272447', '#f0ede4': '#222b27', '#f5f2ea': '#1a231f',
};
const BORDER = {
  '#e3ddd0': '#33413a', '#d8d1c2': '#3a4840', '#cfc6b2': '#44534a', '#c9c2b2': '#44534a', '#dddddd': '#33413a',
  '#c9dcef': '#27506f', '#f0d59c': '#6b5320', '#f3c6c1': '#6b2f29', '#c6dfcf': '#2d5a43', '#ffffff': '#27332d',
  '#eeeae0': '#27332d', '#e6e0d2': '#27332d',
};
const TEXT = {
  '#164b7a': '#8fc3ee', '#1f4d3a': '#8fd1ae', '#1e6a3f': '#7ccb9c', '#1d5f99': '#8fc3ee', '#8f2617': '#f1a89f',
  '#b42318': '#f1a89f', '#8a5200': '#f0c36d', '#5f3a00': '#f0c36d', '#3e4a43': '#c3cdc6', '#4a42a6': '#b7b2f2',
  '#2f6b4f': '#7cc7a0', '#1d2420': '#e8ede9', '#5b665f': '#97a39b',
};
const RGBA_LIGHT = /rgba\(\s*(255\s*,\s*255\s*,\s*255|255\s*,\s*253\s*,\s*249)\s*,\s*([0-9.]+)\s*\)/g;

const norm = (hex) => {
  const h = hex.toLowerCase();
  return h.length === 4 ? '#' + [1, 2, 3].map((i) => h[i] + h[i]).join('') : h;
};

function mapValue(prop, value) {
  const p = prop.toLowerCase();
  let table = null;
  if (/^background(-color|-image)?$/.test(p)) table = BG;
  else if (/^border(-top|-right|-bottom|-left)?(-color)?$/.test(p) || p === 'outline-color') table = BORDER;
  else if (p === 'color' || p === 'fill' || p === 'stroke') table = TEXT;
  if (!table) return value;
  let out = value.replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => table[norm(m)] || m);
  if (table === BG) out = out.replace(RGBA_LIGHT, (m, _c, a) => (parseFloat(a) >= 0.85 ? `rgba(15, 21, 18, ${a})` : m));
  if (p === 'color' && /^var\(--green\)$/.test(out.trim())) out = '#7cc7a0';
  return out;
}

function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Tiny CSS reader: top-level rules and one level of @media/@supports. */
export function parseCss(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  function readBlock(at) {
    while (i < src.length) {
      const open = src.indexOf('{', i);
      const close = src.indexOf('}', i);
      if (at && close !== -1 && (open === -1 || close < open)) {
        i = close + 1;
        return;
      }
      if (open === -1) return;
      const head = src.slice(i, open).trim();
      if (head.startsWith('@media') || head.startsWith('@supports')) {
        i = open + 1;
        readBlock(head);
        continue;
      }
      if (head.startsWith('@')) { // @keyframes, @font-face, @import ...: skip the whole block
        let depth = 1;
        let j = open + 1;
        while (j < src.length && depth > 0) {
          if (src[j] === '{') depth += 1;
          if (src[j] === '}') depth -= 1;
          j += 1;
        }
        i = j;
        continue;
      }
      const end = src.indexOf('}', open);
      rules.push({ at, selector: head, body: src.slice(open + 1, end) });
      i = end + 1;
    }
  }
  readBlock(null);
  return rules;
}

const SCOPE = 'html[data-theme="dark"] body:has([data-surface])';

export function build(read = (file) => readFileSync(root + file, 'utf8')) {
  const out = [];
  for (const { file, allow } of SOURCES) {
    const rules = parseCss(read(file));
    const chunks = [];
    for (const rule of rules) {
      const selectors = splitTopLevel(rule.selector, ',').map((s) => s.trim()).filter(Boolean);
      const keep = allow ? selectors.filter((s) => allow.test(s)) : selectors;
      if (!keep.length) continue;
      const changed = [];
      for (const decl of splitTopLevel(rule.body, ';')) {
        const idx = decl.indexOf(':');
        if (idx < 0) continue;
        const prop = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim().replace(/\s*!important$/, '');
        const important = /!important\s*$/.test(decl.trim());
        const mapped = mapValue(prop, value);
        if (mapped !== value) changed.push(`${prop}: ${mapped}${important ? ' !important' : ''}`);
      }
      if (!changed.length) continue;
      const sel = keep.map((s) => (s === 'body' ? SCOPE : `${SCOPE} ${s}`)).join(',\n');
      chunks.push({ at: rule.at, css: `${sel} { ${changed.join('; ')}; }` });
    }
    if (!chunks.length) continue;
    out.push(`/* ---- ${file} ---- */`);
    let currentAt = null;
    for (const c of chunks) {
      if (c.at !== currentAt) {
        if (currentAt) out.push('}');
        if (c.at) out.push(`${c.at} {`);
        currentAt = c.at;
      }
      out.push(c.css);
    }
    if (currentAt) out.push('}');
  }
  const header = [
    '/* GENERATED by scripts/gen-brand-dark.mjs. Do not edit by hand.',
    ' * Dark-theme overrides for hard-coded colours in the approved brand stylesheets.',
    ' * Applies only on pages with a [data-surface] wrapper and html[data-theme="dark"].',
    ' * Regenerate after changing app/dash.css, account.css, partner.css or the listed globals.css rules:',
    ' *   npm run gen:dark     (CI fails when this file is out of date) */',
  ].join('\n');
  return `${header}\n${out.join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const next = build();
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(OUT, 'utf8'); } catch { /* missing */ }
    if (current !== next) {
      console.error('styles/brand-dark.generated.css is out of date. Run: npm run gen:dark');
      process.exit(1);
    }
    console.log('brand-dark.generated.css is up to date');
  } else {
    writeFileSync(OUT, next);
    console.log(`wrote ${OUT} (${next.split('\n').length} lines)`);
  }
}
