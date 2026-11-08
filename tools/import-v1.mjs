// Einmal-Import aus v1 (nur lesend): Texte, Projekte, Bilder, Lebenslaeufe.
// Aufruf: node tools/import-v1.mjs [pfad-zu-v1]
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v1 = process.argv[2] ?? join(homedir(), 'Projects/portfolio');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const mk = (p) => mkdirSync(p, { recursive: true });

// --- strings.json (Merge) ---
const v1Strings = readJson(join(v1, 'src/strings.json'));
const wanted = /^(about|contact|info|meta|cv)\.|^skills$/;
const stringsPath = join(root, 'src/content/strings.json');
const strings = existsSync(stringsPath) ? readJson(stringsPath) : {};
for (const [k, v] of Object.entries(v1Strings)) if (wanted.test(k)) strings[k] = v;
strings['cv.file'] = { de: 'cv/lebenslauf.pdf', en: 'cv/resume.pdf' };
mk(dirname(stringsPath));
writeFileSync(stringsPath, JSON.stringify(strings, null, 2) + '\n');

// --- Bilder ---
const toWebp = (src, dst) => {
  mk(dirname(dst));
  execFileSync('magick', [src, '-resize', '1280x>', '-quality', '82', dst]);
};
const thumbs = { gen_Ut: 'genut', fretlearn: 'fretlearn', Weitland: 'weitland', NSCS: 'nscs', OnlineIDE: 'onlineide',
  DrawingTool: 'drawingtool', 'JDBC-TicketSystem': 'jdbc-ticketsystem', SpringWeatherWebsite: 'weatherapp',
  SwingShooter2D: 'swing-shootergame', Arkanoid: 'arkanoid', Sudoku: 'sudoku', Store: 'store', rest_api_project: 'rest-api' };
for (const f of Object.values(thumbs))
  toWebp(join(v1, 'assets/projects', f + '.png'), join(root, 'public/img/projects', f + '.webp'));
toWebp(join(v1, 'assets/profile/Akhmedov.jpg'), join(root, 'public/img/portrait.webp'));
mk(join(root, 'public/cv'));
for (const f of ['lebenslauf.pdf', 'resume.pdf']) copyFileSync(join(v1, 'assets/lebenslauf', f), join(root, 'public/cv', f));

// --- projects.json ---
const projects = readJson(join(v1, 'src/projects.json'));
const demos = readJson(join(v1, 'src/demos.json'));
const demoUrl = {};
for (const d of demos) if (d.newTab) demoUrl[d.title.toLowerCase()] = d.newTab;
// In v1 nur als Demo vorhanden (kein Eintrag in projects.json): Text nur das, was v1 hergibt.
const demoOnly = [
  { name: 'Weitland', stack: 'JavaScript', desc: { de: 'Browser-Spiel, direkt im Browser spielbar.', en: 'Browser game, playable right in the browser.' } },
  { name: 'NSCS', stack: 'JavaScript', desc: { de: 'Lernseite, direkt im Browser nutzbar.', en: 'Study page, usable right in the browser.' } },
];
const all = [...projects, ...demoOnly];
const featuredOrder = ['gen_Ut', 'fretlearn', 'Weitland', 'NSCS', 'OnlineIDE', 'DrawingTool'];
const rest = ['JDBC-TicketSystem', 'SpringWeatherWebsite', 'SwingShooter2D', 'Arkanoid', 'Sudoku', 'Store', 'rest_api_project'];
const out = [...featuredOrder, ...rest].map((name) => {
  const p = all.find((x) => x.name === name);
  if (!p) throw new Error('Projekt fehlt: ' + name);
  const o = { name, stack: p.stack, desc: p.desc, thumb: `img/projects/${thumbs[name]}.webp` };
  if (p.repo) o.repo = p.repo;
  const demo = demoUrl[name.toLowerCase()];
  if (demo) o.demo = demo;
  o.featured = featuredOrder.includes(name);
  return o;
});
writeFileSync(join(root, 'src/content/projects.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`strings: ${Object.keys(strings).length} Schluessel, projects: ${out.length}, Bilder: ${Object.keys(thumbs).length + 1}`);
