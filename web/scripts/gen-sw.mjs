// Writes public/sw.js with a unique version for each deploy, so installed apps
// notice the new version (checked on open, on return to screen, every 30 min).
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commit = (process.env.COMMIT_REF || '').slice(0, 7) || String(Date.now());
const version = `thh-${pkg.version}-${commit}`;
const tpl = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
writeFileSync(new URL('../public/sw.js', import.meta.url), tpl.replace('__VERSION__', version));
console.log('sw.js version', version);
