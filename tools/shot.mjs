// Screenshots aller Abschnitte: vite build + vite preview + Firefox (ffbrowser.mjs).
// Aufruf: node tools/shot.mjs [--still] [--mode reduced|no-webgl|no-js] [--pref key=value]... [--no-build]
// Ausgabe: test-results/shots/[<modus>/]<lang>/<id>@<breite>.png; Exit 1 bei Konsolen-/Seitenfehlern.
// --pref setzt Firefox-Prefs im Profil (user.js, Werte true/false/Zahl/Text). --mode ist eine Kurzform:
//   reduced   -> ui.prefersReducedMotion=1      (Bild+Kontrolle: prefers-reduced-motion matcht)
//   no-webgl  -> webgl.disabled=true            (Kontrolle: kein webgl2-Kontext, html.no-webgl)
//   no-js     -> javascript.enabled=false       (kein JS, keine Konsole; Scrollen per #Fragment)
import {spawn, spawnSync} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDS = ['hero', 'bom', 'projekte', 'skills', 'ueber', 'lebenslauf', 'kontakt', 'outro'];
const LANGS = [['de', '/'], ['en', '/en/']];
const VIEWPORTS = [[1440, 900], [390, 844]];

// Argumente
const args = process.argv.slice(2);
const MODES = {
  'reduced': {'ui.prefersReducedMotion': '1'},
  'no-webgl': {'webgl.disabled': 'true'},
  'no-js': {'javascript.enabled': 'false'},
};
const opts = {still: false, quality: 80, build: true, prefs: {}, mode: ''};
const addPref = (kv) => {
  const eq = kv.indexOf('=');
  if (eq < 1) { console.error('--pref erwartet key=value'); process.exit(2); }
  const v = kv.slice(eq + 1);
  opts.prefs[kv.slice(0, eq)] = v === 'true' ? true : v === 'false' ? false : /^-?\d+$/.test(v) ? Number(v) : v;
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--still') opts.still = true;
  else if (a === '--no-build') opts.build = false;
  else if (a === '--mode') {
    opts.mode = args[++i] ?? '';
    if (!MODES[opts.mode]) { console.error('--mode: ' + Object.keys(MODES).join(' | ')); process.exit(2); }
    for (const kv of Object.entries(MODES[opts.mode])) addPref(kv.join('='));
  } else if (a === '--pref') addPref(args[++i] ?? '');
  else if (a.startsWith('--pref=')) addPref(a.slice(7));
  else { console.error('Unbekanntes Argument: ' + a); process.exit(2); }
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

// Standbild: ?still bei 1600x1000, Seite zweimal auf Weiß und Schwarz gerendert (Firefox-Screenshots haben
// keinen Alphakanal), daraus Alpha und Farbe zurückgerechnet -> transparentes WebP (ImageMagick).
async function makeStill(page, base) {
  const W = 1600, H = 1000;
  const out = path.join(root, 'public/img/explosion-still.webp');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-still-'));
  try {
    await page.setViewport(W, H, 1);
    const grab = async (color) => {
      page.clearLogs();
      // Hintergrund per Preload-Skript vor dem ersten Szenen-Frame (eine spätere DOM-Änderung leert den Canvas,
      // und die Szene zeichnet nur bei Bedarf). Spätere Preload-Skripte stehen später im DOM und gewinnen.
      await page.addPreloadScript(`() => {
        const add = () => {
          const st = document.createElement('style');
          st.textContent = 'html.still { background: ${color} !important; }';
          document.documentElement.append(st);
        };
        if (document.documentElement) add(); else document.addEventListener('readystatechange', add, {once: true});
      }`);
      await page.goto(base + '/?still');
      await page.waitForFunction(() => document.readyState === 'complete');
      await page.evaluate(async () => { if (window.__v2?.ready) await window.__v2.ready; });
      await page.waitForFunction(() => document.documentElement.classList.contains('scene-ready'));
      await page.sleep(1500);
      const file = path.join(tmp, color + '.png');
      await page.screenshot({path: file});
      return file;
    };
    const white = await grab('#fff');
    const black = await grab('#000');
    // alpha = 1 - (W - B) / 255 (Grauanteil); Farbe = B / alpha
    const run = (a) => {
      const r = spawnSync('magick', a, {stdio: ['ignore', 'inherit', 'inherit']});
      if (r.status !== 0) throw new Error('magick fehlgeschlagen: ' + a.join(' '));
    };
    const alpha = path.join(tmp, 'alpha.png');
    run([white, '-colorspace', 'sRGB', black, '-colorspace', 'sRGB', '-compose', 'difference', '-composite',
      '-colorspace', 'Gray', '-negate', alpha]);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    // Farbe aus dem Schwarz-Bild ent-multiplizieren (B / alpha), Alpha setzen
    const color = path.join(tmp, 'color.png');
    run([black, alpha, '-alpha', 'off', '-fx', 'u/max(v,0.004)', color]);
    run([color, alpha, '-alpha', 'off', '-compose', 'copy_opacity', '-composite',
      '-define', 'webp:alpha-quality=90', '-define', 'webp:method=6', '-define', 'webp:exact=true',
      '-quality', String(opts.quality), '-strip', out]);
    console.log(`Standbild: ${path.relative(root, out)} (${fs.statSync(out).size} Bytes)`);
    for (const e of page.errors) console.error('Seitenfehler: ' + e.message);
  } finally {
    if (process.env.STILL_KEEP) fs.cpSync(tmp, process.env.STILL_KEEP, {recursive: true});
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

let browser, failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* noch nicht bereit */ }
    if (i > 100) throw new Error('vite preview startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }

  browser = await launch({width: 1440, height: 900, prefs: opts.prefs});
  const page = await browser.newPage();
  const problems = [];
  let count = 0;

  if (opts.still) {
    await makeStill(page, base);
    await browser.close();
    browser = null;
    stopServer();
    process.exit(0);
  }

  const noJs = opts.prefs['javascript.enabled'] === false;
  const shotsDir = path.join(root, 'test-results/shots', opts.mode);
  const check = (cond, msg) => { if (!cond) problems.push(msg); };

  for (const [lang, route] of LANGS) {
    for (const [w, h] of VIEWPORTS) {
      const tag = `[${opts.mode || 'normal'} ${lang}@${w}]`;
      await page.setViewport(w, h, 1);
      page.clearLogs();
      await page.goto(base + route);
      // Ohne JS antwortet script.evaluate nie: dort nur feste Pause (goto wartet schon auf "complete").
      if (noJs) await page.sleep(800);
      else {
        await page.waitForFunction(() => document.readyState === 'complete');
        await page.evaluate(async () => { if (window.__v2?.ready) await window.__v2.ready; });
        await page.sleep(800);
      }
      // Pref wirklich aktiv? (Im Modus no-js ist kein Skript möglich, dort zählt: Seite hat kein .js.)
      if (opts.mode === 'reduced') {
        const r = await page.evaluate(() => ({
          mq: matchMedia('(prefers-reduced-motion: reduce)').matches,
          cls: document.documentElement.className,
          canvas: !!document.querySelector('#scene canvas'),
        }));
        check(r.mq, `${tag} prefers-reduced-motion greift nicht`);
        check(/\breduced\b/.test(r.cls), `${tag} html.reduced fehlt (${r.cls})`);
        check(!r.canvas, `${tag} Canvas trotz reduzierter Bewegung`);
      } else if (opts.mode === 'no-webgl') {
        const r = await page.evaluate(() => ({
          gl: !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl'),
          cls: document.documentElement.className,
        }));
        check(!r.gl, `${tag} WebGL trotz webgl.disabled verfügbar`);
        check(/\bno-webgl\b/.test(r.cls), `${tag} html.no-webgl fehlt (${r.cls})`);
      } else if (opts.mode === 'no-js') {
        // Beweis für deaktiviertes JS: Auswertung bleibt aus (Timeout), sonst lief Skript.
        const ran = await Promise.race([page.evaluate(() => true).catch(() => false), page.sleep(2000).then(() => false)]);
        check(!ran, `${tag} JavaScript lief trotz javascript.enabled=false`);
      }
      for (const id of IDS) {
        let exists = true;
        if (!noJs) exists = await page.evaluate((i) => !!document.getElementById(i), id);
        if (!exists) { console.log(`uebersprungen: ${lang}/#${id} (nicht im DOM)`); continue; }
        // Hero = Seitenanfang: das Standbild steht vor #hero im Fluss und soll im Hero-Bild zu sehen sein.
        const toTop = !!opts.mode && id === 'hero';
        if (noJs) {
          await page.goto(base + route + (toTop ? '' : '#' + id));
          await page.sleep(400);
        } else {
          await page.evaluate(({i, top}) => {
            const el = document.getElementById(i);
            const y = el.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({top: top ? 0 : y, behavior: 'instant'});
          }, {i: id, top: toTop});
          await page.sleep(500);
        }
        const file = path.join(shotsDir, lang, `${id}@${w}.png`);
        await page.screenshot({path: file});
        count++;
        console.log('Screenshot: ' + path.relative(root, file));
      }
      if (!noJs) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (opts.mode) check(over <= 0, `${tag} horizontaler Überlauf: ${over}px`);
      }
      for (const m of page.messages) if (m.type === 'error') problems.push(`${tag} console.error: ${m.text}`);
      for (const e of page.errors) problems.push(`${tag} Seitenfehler: ${e.message}`);
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
