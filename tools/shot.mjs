// Screenshots aller Abschnitte: vite build + vite preview + Firefox (ffbrowser.mjs).
// Aufruf: node tools/shot.mjs [--still] [--pref key=value]... [--no-build]
// Ausgabe: test-results/shots/<lang>/<id>@<breite>.png; Exit 1 bei Konsolen-/Seitenfehlern.
import {spawn, spawnSync} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDS = ['hero', 'bom', 'projekte', 'skills', 'ueber', 'lebenslauf', 'kontakt', 'outro'];
const LANGS = [['de', '/'], ['en', '/en/']];
const VIEWPORTS = [[1440, 900], [390, 844]];

// Argumente
const args = process.argv.slice(2);
const opts = {still: false, build: true, prefs: {}};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--still') opts.still = true;
  else if (a === '--no-build') opts.build = false;
  else if (a === '--pref') {
    const kv = args[++i] ?? '';
    const eq = kv.indexOf('=');
    if (eq < 1) { console.error('--pref erwartet key=value'); process.exit(2); }
    opts.prefs[kv.slice(0, eq)] = kv.slice(eq + 1);
  } else if (a.startsWith('--pref=')) {
    const kv = a.slice(7), eq = kv.indexOf('=');
    if (eq < 1) { console.error('--pref erwartet key=value'); process.exit(2); }
    opts.prefs[kv.slice(0, eq)] = kv.slice(eq + 1);
  } else { console.error('Unbekanntes Argument: ' + a); process.exit(2); }
}
if (opts.still) {
  console.error('--still ist noch nicht implementiert (kommt mit T042).');
  process.exit(1);
}

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => res(port)); });
});

if (opts.build) {
  const b = spawnSync('npx', ['vite', 'build'], {cwd: root, stdio: 'inherit'});
  if (b.status !== 0) { console.error('vite build fehlgeschlagen'); process.exit(1); }
}

const port = await freePort();
const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stopServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* schon beendet */ } };
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServer(); process.exit(130); });

let browser, failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* noch nicht bereit */ }
    if (i > 100) throw new Error('vite preview startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }

  browser = await launch({width: 1440, height: 900});
  const page = await browser.newPage();
  const problems = [];
  let count = 0;

  for (const [lang, route] of LANGS) {
    for (const [w, h] of VIEWPORTS) {
      await page.setViewport(w, h, 1);
      page.clearLogs();
      const qs = Object.entries(opts.prefs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      // TODO T044: --pref key=value wird hier als Seitenzustand/Parameter angewendet.
      await page.goto(base + route + (qs ? '?' + qs : ''));
      await page.waitForFunction(() => document.readyState === 'complete');
      await page.evaluate(async () => { if (window.__v2?.ready) await window.__v2.ready; });
      await page.sleep(800);
      for (const id of IDS) {
        const exists = await page.evaluate((i) => !!document.getElementById(i), id);
        if (!exists) { console.log(`uebersprungen: ${lang}/#${id} (nicht im DOM)`); continue; }
        await page.evaluate((i) => {
          const el = document.getElementById(i);
          const y = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({top: y, behavior: 'instant'});
        }, id);
        await page.sleep(500);
        const file = path.join(root, 'test-results/shots', lang, `${id}@${w}.png`);
        await page.screenshot({path: file});
        count++;
        console.log('Screenshot: ' + path.relative(root, file));
      }
      for (const m of page.messages) if (m.type === 'error') problems.push(`[${lang}@${w}] console.error: ${m.text}`);
      for (const e of page.errors) problems.push(`[${lang}@${w}] Seitenfehler: ${e.message}`);
    }
  }
  console.log(`${count} Screenshots.`);
  if (problems.length) {
    failed = true;
    console.error('Konsolen-/Seitenfehler:\n' + problems.join('\n'));
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  if (browser) await browser.close();
  stopServer();
}
process.exit(failed ? 1 : 0);
