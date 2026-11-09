// Live-Demo prüfen (T082): Dev-Server + Firefox (ffbrowser.mjs, nie Chrome).
//  Ablauf je Größe/Sprache: Projekte-Station → Knopf per Mausklick → Zoom (Fahrt + offen) → Prüfungen → Schließen
//  per Knopf → Tastatur-Durchlauf (Enter öffnet, Escape schließt) → erneut öffnen (iframe lädt neu).
//  Geprüft wird: Zustand (demoOpen/demoMix, html-Klassen, iframe-Größe/-Transform), Seite inert, Fokus (testmode!),
//  kein Scrollen im offenen Zustand, Kamera/Scrollposition nach dem Schließen wie vorher, Ruhe = 0 Draw-Calls,
//  Bildabstände während der Fahrt (Richtwert, headless), keine Konsolenfehler.
//  Das iframe lädt eine lokale Testseite (data:-URL mit farbigem Rand), nie die echte Demo.
// Aufruf: node tools/demo-shot.mjs [--size 1440x900] [--lang de|en] [--real] [--json datei]
//  ohne --size/--lang: 1440x900 und 1280x800, de und en. --real nimmt die echte Demo-URL des Knopfes (braucht Netz).
// Ausgabe: test-results/shots/demo/{0-vorher,1-fahrt1…4,2-offen,3-zurueck,3b-zurueck,4-geschlossen,5-tastatur-offen,6-tastatur-zu}-<lang>@<breite>.png
//  und test-results/shots/demo/messung.json; Exit 1 bei Fehlern.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let sizes = [[1440, 900], [1280, 800]], langs = ['de', 'en'], real = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') sizes = [args[++i].split('x').map(Number)];
  else if (args[i] === '--lang') langs = [args[++i]];
  else if (args[i] === '--real') real = true;
  else { console.error('Unbekanntes Argument: ' + args[i]); process.exit(2); }
}
const outDir = path.join(root, 'test-results/shots/demo');
fs.rmSync(outDir, {recursive: true, force: true});
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
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

const TEST = 'data:text/html,' + encodeURIComponent(`<!doctype html><html><body style="margin:0;background:#fff">
<div style="position:fixed;inset:0;border:4px solid #f0f;box-sizing:border-box"></div>
<div style="position:fixed;left:0;top:0;width:40px;height:40px;background:#0f0"></div>
<div style="position:fixed;right:0;bottom:0;width:40px;height:40px;background:#0ff"></div>
<p style="font:24px sans-serif;margin:60px;color:#f0f">TESTSEITE iframe</p><button>Test-Knopf im iframe</button></body></html>`);

const TAB = '', SHIFT = '', ENTER = '', ESC = '';
let failed = false;
const results = [];
const fail = (msg) => { failed = true; console.error('FEHLER: ' + msg); };

async function run(size, lang, base) {
  const tag = `${lang}@${size[0]}`;
  const res = {tag, size: size.join('x')};
  results.push(res);
  const browser = await launch({width: size[0], height: size[1], prefs: {'focusmanager.testmode': true}});
  try {
    const page = await browser.newPage();
    await page.setViewport(size[0], size[1], 1);
    // Zählt Draw-Calls (Ruhe muss 0 sein) und Bildabstände (rAF) für die Messung
    await page.addPreloadScript(`() => {
      window.__draws = 0;
      for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
        if (!P) continue;
        for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
          const f = P[n]; if (f) P[n] = function (...a) { window.__draws++; return f.apply(this, a); };
        }
      }
      window.__frames = null;
      window.__sampleFrames = (ms) => new Promise((resolve) => {
        const t = []; const t0 = performance.now();
        const tick = (now) => { t.push(now); if (now - t0 < ms) requestAnimationFrame(tick); else resolve(t); };
        requestAnimationFrame(tick);
      });
    }`);
    await page.goto(base + (lang === 'en' ? '/en/' : '/'));
    await page.waitForFunction(() => !!(window.__v2 && window.__v2.marks && window.__v2.marks()), undefined, {timeout: 30000});
    await page.evaluate(async () => { await window.__v2.ready; await document.fonts.ready; });
    await page.sleep(1500);
    const ctx = (await page.bidi('browsingContext.getTree', {})).contexts[0].context;
    const keys = async (...seq) => {
      await page.bidi('input.performActions', {context: ctx, actions: [{type: 'key', id: 'kbd',
        actions: seq.flatMap((v) => Array.isArray(v) ? v : [{type: 'keyDown', value: v}, {type: 'keyUp', value: v}])}]});
    };
    const shiftTab = [{type: 'keyDown', value: SHIFT}, {type: 'keyDown', value: TAB}, {type: 'keyUp', value: TAB}, {type: 'keyUp', value: SHIFT}];
    const shot = (name) => page.screenshot({path: path.join(outDir, `${name}-${tag}.png`)});
    const snap = () => page.evaluate(() => {
      const f = document.getElementById('demo-frame');
      const a = document.activeElement;
      const close = document.getElementById('demo-close');
      return {
        y: Math.round(scrollY), sw: document.documentElement.clientWidth, cls: document.documentElement.className,
        mix: window.__v2.state.demoMix, open: window.__v2.state.demoOpen, cam: window.__v2.state.cam,
        frame: f ? {src: f.src.slice(0, 30), w: f.style.width, h: f.style.height, t: f.style.transform.slice(0, 60), vis: f.style.visibility,
          cls: f.className, title: f.title, inert: f.inert, r: (({x, y, width, height}) => ({x, y, w: width, h: height}))(f.getBoundingClientRect())} : null,
        active: a ? (a.id || a.tagName.toLowerCase()) : null, activeIsOpener: !!a?.matches?.('[data-demo-open]'), activeInMain: !!a?.closest?.('#main'),
        hasFocus: document.hasFocus(), exp: [...document.querySelectorAll('[data-demo-open]')].map((b) => b.getAttribute('aria-expanded')),
        inert: ['main', 'labels'].map((id) => document.getElementById(id)?.inert), mainInert: document.getElementById('main')?.inert,
        closeHidden: close?.hidden, closeRect: close && !close.hidden ? (({x, y, width, height}) => ({x, y, w: width, h: height}))(close.getBoundingClientRect()) : null,
      };
    });

    // Station: zwischen zwei Projekt-Schritten, ein Datenblatt mit Demo-Knopf sichtbar
    const m = await page.evaluate(() => window.__v2.marks());
    const step = (m.stepsEnd - m.projEnd) / 6;
    await page.evaluate((top) => window.scrollTo({top, behavior: 'instant'}), Math.round(m.projEnd + 1.5 * step));
    await page.sleep(1500);
    await shot('0-vorher');
    const before = await snap();
    const btn = await page.evaluate((test) => {
      const b = [...document.querySelectorAll('[data-demo-open]')].find((el) => getComputedStyle(el.closest('[data-step]')).opacity > 0.5);
      if (!b) return null;
      b.id = 'demo-test-opener';
      if (test) b.dataset.demoUrl = test;
      const r = b.getBoundingClientRect();
      return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), name: b.closest('[data-step]').dataset.step};
    }, real ? '' : TEST);
    if (!btn) { fail(`${tag}: kein sichtbarer Demo-Knopf`); return; }
    console.log(`[${tag}] vorher y=${before.y} cam=${before.cam.toFixed(3)} Knopf in "${btn.name}"`);
    const mouse = (x, y) => page.bidi('input.performActions', {context: ctx, actions: [{type: 'pointer', id: 'm',
      parameters: {pointerType: 'mouse'}, actions: [{type: 'pointerMove', x, y}, {type: 'pointerDown', button: 0}, {type: 'pointerUp', button: 0}]}]});

    // ---- 1. Öffnen per Mausklick; Bildabstände der Fahrt über 1,6 s
    const rideP = page.evaluate(() => window.__sampleFrames(1600));
    await mouse(btn.x, btn.y);
    const mid = [];
    for (let i = 1; i <= 4; i++) {
      await page.sleep(170);
      mid.push(await page.evaluate(() => +window.__v2.state.demoMix.toFixed(2)));
      await shot(`1-fahrt${i}`);
    }
    const ride = await rideP;
    await page.sleep(900);
    await shot('2-offen');
    const open = await snap();
    console.log(`[${tag}] Fahrt demoMix`, mid.join(' → '), '| offen', JSON.stringify({mix: open.mix, cls: open.cls, active: open.active, frame: open.frame}));
    if (open.mix !== 1 || !open.open) fail(`${tag}: nach dem Öffnen nicht demoMix=1/demoOpen`);
    for (const c of ['demo-on', 'demo-dim', 'demo-zoom']) if (!open.cls.includes(c)) fail(`${tag}: html.${c} fehlt im offenen Zustand`);
    if (!open.frame) fail(`${tag}: kein #demo-frame`);
    else {
      if (!open.frame.cls.includes('is-open')) fail(`${tag}: iframe ohne .is-open`);
      if (open.frame.vis === 'hidden') fail(`${tag}: iframe versteckt`);
      if (!/^translate\(/.test(open.frame.t)) fail(`${tag}: iframe in Ruhe nicht scharf (translate), sondern ${open.frame.t}`);
      const r = open.frame.r;
      if (r.x < 0 || r.y < 0 || r.x + r.w > size[0] + 1 || r.y + r.h > size[1] + 1) fail(`${tag}: iframe außerhalb des Fensters ${JSON.stringify(r)}`);
      if (Math.abs(r.x + r.w / 2 - open.sw / 2) > 2) fail(`${tag}: iframe nicht mittig ${JSON.stringify(r)} (clientWidth ${open.sw})`);
      if (open.closeRect && open.closeRect.y + open.closeRect.h > r.y + 1) console.log(`[${tag}] Hinweis: „Schließen“ (${JSON.stringify(open.closeRect)}) überlappt das iframe (${JSON.stringify(r)})`);
    }
    if (!open.mainInert) fail(`${tag}: #main nicht inert`);
    if (open.closeHidden) fail(`${tag}: „Schließen“ nicht sichtbar`);
    if (open.active !== 'demo-frame') fail(`${tag}: Fokus nicht im iframe (${open.active})`);
    if (open.exp.indexOf('true') < 0) fail(`${tag}: aria-expanded nicht true`);
    // Ruhe: keine Draw-Calls bei offener Demo
    const d0 = await page.evaluate(() => window.__draws);
    await page.sleep(2000);
    const d1 = await page.evaluate(() => window.__draws);
    const idleFps = await page.evaluate(() => window.__v2.fps());
    console.log(`[${tag}] Ruhe offen: ${d1 - d0} Draw-Calls in 2 s, __v2.fps()=${idleFps}`);
    if (d1 - d0 !== 0) fail(`${tag}: ${d1 - d0} Draw-Calls in Ruhe bei offener Demo`);
    // Mausrad darf nicht scrollen
    await page.bidi('input.performActions', {context: ctx, actions: [{type: 'wheel', id: 'w', actions: [{type: 'scroll', x: 10, y: size[1] - 10, deltaX: 0, deltaY: 700}]}]});
    await page.sleep(600);
    const afterWheel = await snap();
    if (afterWheel.y !== open.y) fail(`${tag}: Mausrad scrollt bei offener Demo (${open.y} → ${afterWheel.y})`);
    // Tab / Shift+Tab: Fokus darf nie in die inerte Seite wandern
    const trail = [];
    for (let k = 0; k < 5; k++) { await keys(k % 2 ? TAB : shiftTab); await page.sleep(120); const s = await snap(); trail.push(s.active); if (s.activeInMain) fail(`${tag}: Tab-Fokus in der inerten Seite`); }
    console.log(`[${tag}] Tab-Pfad bei offener Demo:`, trail.join(' → '));

    // ---- 2. Schließen per Knopf (echter Mausklick)
    await page.evaluate(() => document.getElementById('demo-close').scrollIntoView?.());
    const cr = open.closeRect;
    await mouse(Math.round(cr.x + cr.w / 2), Math.round(cr.y + cr.h / 2));
    await page.sleep(330);
    await shot('3-zurueck');
    const back = await snap();
    await page.sleep(350);
    await shot('3b-zurueck');
    await page.sleep(1300);
    await shot('4-geschlossen');
    const after = await snap();
    console.log(`[${tag}] Rückfahrt demoMix ${back.mix.toFixed(2)} | nachher`, JSON.stringify({y: after.y, cam: +after.cam.toFixed(3), cls: after.cls, active: after.active, frame: !!after.frame, exp: after.exp}));
    if (after.frame) fail(`${tag}: iframe nach dem Schließen noch da`);
    if (/demo-/.test(after.cls)) fail(`${tag}: html-Klasse nach dem Schließen: ${after.cls}`);
    if (after.mix !== 0 || after.open) fail(`${tag}: State nach dem Schließen: mix=${after.mix} open=${after.open}`);
    if (after.y !== before.y || Math.abs(after.cam - before.cam) > 1e-3) fail(`${tag}: Position/Kamera nicht zurück (y ${before.y} → ${after.y}, cam ${before.cam} → ${after.cam})`);
    if (after.mainInert) fail(`${tag}: #main nach dem Schließen noch inert`);
    if (!after.activeIsOpener) fail(`${tag}: Fokus nicht beim Knopf, sondern ${after.active}`);
    if (after.exp.includes('true')) fail(`${tag}: aria-expanded noch true`);
    if (!after.closeHidden) fail(`${tag}: „Schließen“ noch sichtbar`);
    // Scrollen geht wieder (Lenis läuft)
    await page.bidi('input.performActions', {context: ctx, actions: [{type: 'wheel', id: 'w2', actions: [{type: 'scroll', x: Math.round(size[0] / 2), y: Math.round(size[1] / 2), deltaX: 0, deltaY: 300}]}]});
    await page.sleep(1200);
    const scrolled = await snap();
    if (scrolled.y <= after.y) fail(`${tag}: Scrollen nach dem Schließen geht nicht (${after.y} → ${scrolled.y})`);
    await page.evaluate((top) => window.scrollTo({top, behavior: 'instant'}), before.y);
    await page.sleep(1200);

    // ---- 3. Tastatur: Fokus auf den Knopf, Enter öffnet, Fokus im iframe, Umschalt+Tab erreicht „Schließen“, Escape schließt
    await page.evaluate(() => document.getElementById('demo-test-opener').focus({preventScroll: true}));
    await page.sleep(200);
    const pre = await snap();
    if (!pre.activeIsOpener || !pre.hasFocus) fail(`${tag}: Testmodus: Knopf hat keinen Fokus (${pre.active}, hasFocus ${pre.hasFocus})`);
    await keys(ENTER);
    await page.sleep(1800);
    await shot('5-tastatur-offen');
    const kopen = await snap();
    if (!kopen.open || kopen.mix !== 1) fail(`${tag}: Enter öffnet nicht (open=${kopen.open}, mix=${kopen.mix})`);
    if (kopen.active !== 'demo-frame') fail(`${tag}: Fokus nach Enter nicht im iframe (${kopen.active})`);
    // Die Testseite hat einen Knopf: Umschalt+Tab wandert erst darin, dann zu „Schließen“ (andere Herkunft: Escape im iframe
    // erreicht die Seite nicht, siehe src/choreo/demo.ts). Escape wird deshalb mit Fokus auf „Schließen“ geschickt.
    let sh = kopen;
    const path2 = [];
    for (let k = 0; k < 4 && sh.active !== 'demo-close'; k++) { await keys(shiftTab); await page.sleep(150); sh = await snap(); path2.push(sh.active); }
    console.log(`[${tag}] Umschalt+Tab aus dem iframe: ${path2.join(' → ')}`);
    if (sh.active !== 'demo-close') fail(`${tag}: Umschalt+Tab aus dem iframe erreicht „Schließen“ nicht (${sh.active})`);
    await keys(ESC);
    await page.sleep(1800);
    await shot('6-tastatur-zu');
    const kclosed = await snap();
    console.log(`[${tag}] Escape → open=${kclosed.open} Fokus=${kclosed.active} (Knopf: ${kclosed.activeIsOpener}) frame=${!!kclosed.frame} hasFocus=${kclosed.hasFocus}`);
    if (kclosed.open || kclosed.frame || !kclosed.activeIsOpener) fail(`${tag}: Escape schließt nicht sauber (open=${kclosed.open}, frame=${!!kclosed.frame}, Fokus ${kclosed.active})`);
    if (kclosed.y !== before.y) fail(`${tag}: Position nach Escape ${kclosed.y} ≠ ${before.y}`);
    // Enter auf dem Knopf öffnet gleich wieder (Fokus liegt auf ihm), zweites Laden des iframes
    await keys(ENTER);
    await page.sleep(1800);
    const again = await snap();
    if (!again.open || !again.frame) fail(`${tag}: zweites Öffnen klappt nicht`);
    await page.evaluate(() => document.getElementById('demo-close').click());
    await page.sleep(1800);
    const last = await snap();
    if (last.open || last.frame || last.y !== before.y) fail(`${tag}: nach zweitem Schließen open=${last.open} frame=${!!last.frame} y=${last.y}`);

    // ---- Messwerte: Bildabstände der Fahrt (headless = Richtwert)
    const gaps = ride.slice(1).map((t, i) => t - ride[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    Object.assign(res, {rideFrames: ride.length, rideFps: +(1000 / avg).toFixed(1), rideWorstGap: +Math.max(...gaps).toFixed(1),
      rideOver33: gaps.filter((g) => g > 33.4).length, idleDraws2s: d1 - d0, idleFps});
    console.log(`[${tag}] Fahrt-Bildabstände: ${res.rideFrames} Frames in 1,6 s, Ø ${res.rideFps} fps, längster Abstand ${res.rideWorstGap} ms, > 33 ms: ${res.rideOver33}`);

    const problems = [
      ...page.messages.filter((x) => x.type === 'error').map((x) => 'console.error: ' + x.text),
      ...page.errors.map((e) => 'Seitenfehler: ' + e.message),
    ];
    if (problems.length) fail(`${tag}: ${problems.join(' | ')}`);
  } finally {
    await browser.close();
  }
}

try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 150) throw new Error('vite startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const size of sizes) for (const lang of langs) await run(size, lang, base);
} catch (e) { failed = true; console.error(e); }
finally {
  fs.writeFileSync(path.join(outDir, 'messung.json'), JSON.stringify(results, null, 1));
  stop();
}
console.log(failed ? 'FEHLER (siehe oben)' : 'demo-shot: alles in Ordnung');
process.exit(failed ? 1 : 0);
