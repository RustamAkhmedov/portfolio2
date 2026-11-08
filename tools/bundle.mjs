// Bundle-Budget (T070, Constitution III): JS der Startseite <= 350 KB gzip.
// Liest dist/assets/*.js (vorher `npm run build`), gzip per zlib, Tabelle + Summe, Exit 1 bei Überschreitung.
// Zusätzlich: Größe des Starts ohne Szene (statische Imports von dist/index.html aus, ohne dynamische import()).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');
const LIMIT = 350 * 1000; // „KB“ wie vite: 1 kB = 1000 Byte
if (!fs.existsSync(assets)) { console.error('dist/ fehlt: erst `npm run build`.'); process.exit(2); }

const gz = (f) => zlib.gzipSync(fs.readFileSync(f), {level: 9}).length;
const kb = (n) => (n / 1000).toFixed(1).padStart(7) + ' kB';
const files = fs.readdirSync(assets).filter((f) => f.endsWith('.js')).sort();
const info = Object.fromEntries(files.map((f) => {
  const p = path.join(assets, f);
  return [f, {raw: fs.statSync(p).size, gzip: gz(p), src: fs.readFileSync(p, 'utf8')}];
}));

console.log('Chunk'.padEnd(36) + '     roh      gzip');
let raw = 0, total = 0;
for (const f of files.sort((a, b) => info[b].gzip - info[a].gzip)) {
  console.log(f.padEnd(36) + kb(info[f].raw) + kb(info[f].gzip));
  raw += info[f].raw; total += info[f].gzip;
}
console.log('Summe JS (alle Chunks)'.padEnd(36) + kb(raw) + kb(total) + `   Grenze ${LIMIT / 1000} kB`);

// Start ohne Szene: <script type=module src> der HTML-Seite plus deren statische `import ... from "./x.js"`
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const entry = [...html.matchAll(/<script[^>]+src="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
const seen = new Set();
const walk = (f) => {
  if (seen.has(f) || !info[f]) return;
  seen.add(f);
  // statische Importe: `import"./x.js"`, `import{a}from"./x.js"`, `export{..}from"./x.js"` (nicht `import("./x.js")`)
  for (const m of info[f].src.matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[^"'();]*?\bfrom\s*)?["']\.\/([^"']+\.js)["']/g)) walk(m[1]);
};
entry.forEach(walk);
let start = 0;
console.log('\nStart ohne Szene (statisch von index.html erreichbar):');
for (const f of seen) { console.log('  ' + f.padEnd(34) + kb(info[f].gzip)); start += info[f].gzip; }
console.log('  Summe'.padEnd(36) + kb(start));

if (total > LIMIT) { console.error(`\nBUDGET GERISSEN: ${(total / 1000).toFixed(1)} kB > ${LIMIT / 1000} kB`); process.exit(1); }
console.log('\nBudget eingehalten.');
