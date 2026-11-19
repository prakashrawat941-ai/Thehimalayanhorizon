"""Build tests/fixtures.json from the starter-content migration (for offline UI tests)."""
import json, re, uuid, sys, pathlib
sql = pathlib.Path('supabase/migrations/20261119000003_starter_content.sql').read_text()

def parse_values(s):
    rows, row, i, depth, tok = [], [], 0, 0, ''
    while i < len(s):
        c = s[i]
        if c == ';' and depth == 0: break
        if c == "'":
            j = i + 1; buf = ''
            while True:
                if s[j] == "'" and j + 1 < len(s) and s[j+1] == "'": buf += "'"; j += 2; continue
                if s[j] == "'": break
                buf += s[j]; j += 1
            tok = ('STR', buf); i = j + 1; continue
        if c == '(':
            depth += 1
            if depth == 1: row = []; tok = ''
            i += 1; continue
        if c in ',)' and depth == 1:
            row.append(tok if isinstance(tok, tuple) else tok.strip()); tok = ''
            if c == ')': depth -= 1; rows.append(row)
            i += 1; continue
        if depth == 0 and s.startswith('on conflict', i): break
        if depth >= 1 and not isinstance(tok, tuple): tok += c
        i += 1
    return rows

def conv(v, col):
    if isinstance(v, tuple):
        s = v[1]
        if s.startswith('{') and s.endswith('}') and col in ('theme_slugs',):
            return [x for x in s[1:-1].split(',') if x]
        if col in ('value', 'days'): return json.loads(s)
        return s
    if v in ('true', 'false'): return v == 'true'
    if re.fullmatch(r'-?\d+', v): return int(v)
    return v

out = {}
for m in re.finditer(r"insert into public\.(\w+) \(([^)]*)\) values", sql):
    table, cols, body = m.group(1), [c.strip() for c in m.group(2).split(',')], sql[m.end():]
    rows = []
    for r in [x for x in parse_values(body) if len(x) == len(cols)]:
        d = {c: conv(v, c) for c, v in zip(cols, r)}
        if table != 'site_settings': d['id'] = str(uuid.uuid5(uuid.NAMESPACE_DNS, table + json.dumps(d, sort_keys=True)))
        rows.append(d)
    out[table] = rows
defaults = {
  'locations': dict(description='', best_season='', how_to_reach='', image_url=None, gallery=[], lat=None, lng=None),
  'themes': dict(image_url=None, is_published=True),
  'itineraries': dict(image_url=None, location_ids=[]),
  'home_sections': dict(image_url=None, enabled=True, data={}),
}
for t, d in defaults.items():
    for r in out[t]:
        for k, v in d.items(): r.setdefault(k, v)
for k, v in out.items(): print(k, len(v))
# cta_label_hi is added by migration 0006; tests patch it in
pathlib.Path('tests/fixtures.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
