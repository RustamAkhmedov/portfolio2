// Sprachumschalter prüfen (T061): Dev-Server + Firefox. Scrollt zu Abschnitten, klickt den Umschalter, prüft
// Ziel-URL (Hash) und window.__v2.state auf der Zielseite. Aufruf: node tools/lang-shot.mjs [--size 1440x900]
// Ausgabe: test-results/shots/lang/<breite>/<von>-<nr>-<abschnitt>.png; Exit 1 bei Abweichungen.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let size = [1440, 900];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') size = args[++i].split('x').map(Number);
  else { console.error('Unbekanntes Argument: ' + args[i]); process.exit(2); }
}
const outDir = path.join(root, 'test-results/shots/lang', String(size[0]));
fs.mkdirSync(outDir, {recursive: true});

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => res(port)); });
});
const port = await freePort();
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* beendet */ } };
process.on('exit', stop);

// Fälle: Startsprache, Abschnitt (Anker-Id oder null = Hero), Marken-Schlüssel für die Scroll-Position
const cases = [
  ['de', 'skills', 'sec0Pin', 3, 'board'],
  ['en', 'skills', 'sec0Pin', 3, 'board'],
  ['de', 'kontakt', 'sec3Pin', 3, 'ports'],
  ['en', 'projekte', 'projEnd', null, null],
  ['de', null, null, null, null],
  ['en', 'outro', 'outroEnd', null, null],
];
const markY = (m, key) => key ? m[key] : 0;

let browser, failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 150) throw new Error('vite startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await launch({width: size[0], height: size[1]});
  const page = await browser.newPage();
  await page.setViewport(size[0], size[1], 1);
  page.clearLogs();
  const ready = async () => {
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForFunction(() => !!(window.__v2 && window.__v2.marks && window.__v2.marks()), undefined, {timeout: 30000});
    await page.evaluate(async () => { await window.__v2.ready; await document.fonts.ready; });
    await page.sleep(1800);
  };
  let n = 0;
  for (const [lang, id, key, cam, focus] of cases) {
    n++;
    await page.goto(base + (lang === 'en' ? '/en/' : '/'));
    await ready();
    const marks = await page.evaluate(() => window.__v2.marks());
    const y = markY(marks, key);
    await page.evaluate((top) => window.scrollTo({top, behavior: 'instant'}), y);
    await page.sleep(1200);
    const before = await page.evaluate(() => ({s: {...window.__v2.state}, href: document.querySelector('a[data-lang-switch]').getAttribute('href')}));
    const tag = `${lang}-${String(n).padStart(2, '0')}-${id ?? 'hero'}`;
    await page.screenshot({path: path.join(outDir, `${tag}-vorher.png`)});
    await page.evaluate(() => document.querySelector('a[data-lang-switch]').click());
    await page.sleep(500);
    await ready();
    await page.sleep(1500);
    const after = await page.evaluate(() => ({url: location.href, hash: location.hash, lang: document.documentElement.lang, y: Math.round(scrollY), s: {...window.__v2.state}}));
    await page.sleep(800);
    await page.screenshot({path: path.join(outDir, `${tag}-nachher.png`)});
    const m2 = await page.evaluate(() => window.__v2.marks());
    const want = id ? `#${id}` : '';
    const ok = after.hash === want && after.lang !== lang && Math.abs(after.y - markY(m2, key)) <= 3
      && (cam === null || (after.s.cam >= cam - 0.05 && (!focus || after.s.focus === focus)));
    console.log(`${ok ? 'OK  ' : 'FEHL'} ${lang}→${after.lang} ${id ?? 'hero'}: href=${before.href} → ${after.url} y=${after.y} (soll ${markY(m2, key)}) cam=${after.s.cam.toFixed(2)} focus=${after.s.focus} explode=${after.s.explode.toFixed(2)}`);
    if (!ok) failed = true;
  }
  const errs = [...page.messages.filter((m) => m.type === 'error').map((m) => m.text), ...page.errors.map((e) => e.message)];
  if (errs.length) { failed = true; console.error(errs.join('\n')); }
} catch (e) { failed = true; console.error(e); }
finally { if (browser) await browser.close(); stop(); }
process.exit(failed ? 1 : 0);
