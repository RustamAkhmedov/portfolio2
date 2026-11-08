// Tastatur und Anker prüfen (T053/T054): Dev-Server + Firefox (ffbrowser.mjs, nie Chrome).
//  1. Anker: jeder Link #id (Stückliste, Überspringen, Hero) per Klick → scrollY muss auf der Marke der Timeline landen
//  2. Hash in der URL beim Laden (/#kontakt) und Zurück-Taste
//  3. Tab-Durchlauf (echte Tastenereignisse): protokolliert Element, scrollY, Sichtbarkeit; Screenshots mit Fokusring
// Aufruf: node tools/focus-shot.mjs [--size 1440x900] [--lang de|en] [--settle ms] [--skip-tab]
// Ausgabe: test-results/shots/focus/<breite>/…png; Exit 1 bei Fehlern (Fokus unsichtbar, Anker verfehlt, Konsolenfehler).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let size = [1440, 900], lang = 'de', settle = 1800, tab = true;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') size = args[++i].split('x').map(Number);
  else if (args[i] === '--lang') lang = args[++i];
  else if (args[i] === '--settle') settle = Number(args[++i]);
  else if (args[i] === '--skip-tab') tab = false;
  else { console.error('Unbekanntes Argument: ' + args[i]); process.exit(2); }
}
const outDir = path.join(root, 'test-results/shots/focus', String(size[0]));
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

let browser, failed = false;
const fail = (msg) => { failed = true; console.error('FEHLER: ' + msg); };
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 150) throw new Error('vite startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  // focusmanager.testmode: auch im headless-Fenster gilt die Seite als fokussiert (sonst kein :focus, kein focusin)
  browser = await launch({width: size[0], height: size[1], prefs: {'focusmanager.testmode': true}});
  const page = await browser.newPage();
  await page.setViewport(size[0], size[1], 1);
  const ctx = (await page.bidi('browsingContext.getTree', {})).contexts[0].context;
  const key = async (value) => {
    await page.bidi('input.performActions', {context: ctx, actions: [{type: 'key', id: 'kbd', actions: [
      {type: 'keyDown', value}, {type: 'keyUp', value}]}]});
  };
  const TAB = '', SHIFT = '', ENTER = '';
  const url = base + (lang === 'en' ? '/en/' : '/');
  const ready = async () => {
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForFunction(() => !!(window.__v2 && window.__v2.marks && window.__v2.marks()), undefined, {timeout: 30000});
    await page.evaluate(async () => { await window.__v2.ready; await document.fonts.ready; });
    await page.sleep(1500);
  };
  const anchors = (m) => ({hero: 0, bom: m.explodeEnd, projekte: m.projEnd, skills: m.sec0Pin, ueber: m.sec1Pin,
    lebenslauf: m.sec2Pin, kontakt: m.sec3Pin, outro: m.outroEnd});
  const shot = async (name) => page.screenshot({path: path.join(outDir, name + '.png')});
  const describe = () => page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    const cs = getComputedStyle(a);
    const op = (() => { let o = 1; for (let e = a; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; })();
    const stage = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-h')) || 0;
    const stageBottom = document.documentElement.classList.contains('scene-on') ? (document.getElementById('scene').getBoundingClientRect().bottom > 0 && innerWidth < 900 ? document.getElementById('scene').getBoundingClientRect().bottom : 0) : 0;
    return {tag: a.tagName.toLowerCase(), id: a.id, text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      href: a.getAttribute('href') || '', y: Math.round(scrollY), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height),
      inView: (a.classList.contains('skip') ? r.top >= 0 : r.top >= stageBottom - 1) && r.bottom <= innerHeight + 1 && r.width > 0, opacity: Number(op.toFixed(2)),
      vis: cs.visibility, focusVisible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, stageBottom: Math.round(stageBottom),
      state: {...window.__v2.state}, stage};
  });

  // Das headless-Fenster ist nie „aktiv“ (document.hasFocus() false): Firefox schickt dann weder focusin noch
  // :focus/:focus-visible, obwohl Tab das Element wählt und scrollt. Deshalb: focusin von Hand nachreichen und die
  // :focus/:focus-visible-Regeln der echten Stylesheets auf [data-ring] spiegeln (gleiche Tokens, nur anderer Selektor).
  const afterKey = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('[data-ring]').forEach((e) => e.removeAttribute('data-ring'));
      if (!document.getElementById('ring-mirror')) {
        const css = [];
        for (const sheet of document.styleSheets) {
          let rules; try { rules = sheet.cssRules; } catch { continue; }
          const walk = (list) => { for (const r of list) {
            if (r.cssRules && !r.selectorText) { if (r.type === 4 || r.constructor.name.includes('Media')) { const inner = []; walk2(r, inner); if (inner.length) css.push(`@media ${r.conditionText || r.media.mediaText}{${inner.join('')}}`); } continue; }
            if (r.selectorText && /:focus(-visible)?(?![-\w])/.test(r.selectorText)) css.push(r.cssText.replace(/:focus-visible|:focus(?![-\w])/g, '[data-ring]'));
          } };
          const walk2 = (m, out) => { for (const r of m.cssRules) if (r.selectorText && /:focus(-visible)?(?![-\w])/.test(r.selectorText)) out.push(r.cssText.replace(/:focus-visible|:focus(?![-\w])/g, '[data-ring]')); };
          walk(rules);
        }
        const st = document.createElement('style'); st.id = 'ring-mirror'; st.textContent = css.join('\n'); document.head.appendChild(st);
      }
      const a = document.activeElement;
      if (a && a !== document.body) {
        a.setAttribute('data-ring', '');
        if (!document.hasFocus()) a.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
      }
    });
  };
  page.clearLogs();
  await page.goto(url);
  await ready();
  const marks = await page.evaluate(() => window.__v2.marks());
  const A = anchors(marks);
  console.log('Anker-Ziele:', JSON.stringify(A));

  // ---- 1. Anker per Klick ----
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => ({href: a.getAttribute('href'), text: a.textContent.trim(), where: a.closest('#bom') ? 'bom' : a.className})));
  console.log(`${links.length} Anker-Links:`, links.map((l) => l.href).join(' '));
  for (const id of ['kontakt', 'projekte', 'skills', 'bom', 'ueber', 'lebenslauf', 'outro', 'hero']) {
    // Link per Klick-Ereignis auslösen (wie Maus); danach warten, bis Lenis angekommen ist
    const ok = await page.evaluate((id) => {
      const a = document.querySelector(`a[href="#${id}"]`);
      if (!a) return false;
      a.click();
      return true;
    }, id);
    if (!ok) { console.log(`#${id}: kein Link im Dokument (übersprungen)`); continue; }
    await page.sleep(settle + 1500);
    const info = await page.evaluate(() => ({y: Math.round(scrollY), hash: location.hash, active: document.activeElement.id, st: {...window.__v2.state}}));
    const dy = info.y - A[id];
    const good = Math.abs(dy) <= 2 && info.hash === '#' + id;
    console.log(`#${id.padEnd(10)} scrollY=${String(info.y).padStart(5)} Ziel=${String(A[id]).padStart(5)} Δ=${dy} hash=${info.hash} focus=#${info.active} cam=${info.st.cam.toFixed(2)} focus=${info.st.focus} ${good ? 'ok' : 'ABWEICHUNG'}`);
    if (!good) fail(`Anker #${id} landet bei ${info.y}, Ziel ${A[id]}`);
    await shot(`anker-${id}`);
  }
  // Zurück-Taste: letzter Klick war #lebenslauf, davor #ueber
  await page.evaluate(() => history.back());
  await page.sleep(settle);
  const back = await page.evaluate(() => ({y: Math.round(scrollY), hash: location.hash}));
  console.log(`Zurück: scrollY=${back.y} hash=${back.hash} (erwartet ${A.ueber}, #ueber)`);
  if (Math.abs(back.y - A.ueber) > 2 || back.hash !== '#ueber') fail('Zurück-Taste landet nicht bei #ueber');
  await page.evaluate(() => history.forward());
  await page.sleep(settle);
  const fwd = await page.evaluate(() => ({y: Math.round(scrollY), hash: location.hash}));
  console.log(`Vor: scrollY=${fwd.y} hash=${fwd.hash}`);

  // ---- 2. Hash beim Laden ----
  for (const id of ['kontakt', 'projekte']) {
    await page.goto(url + '#' + id);
    await ready();
    const y = await page.evaluate(() => Math.round(scrollY));
    console.log(`Laden mit /#${id}: scrollY=${y} Ziel=${A[id]}`);
    if (Math.abs(y - A[id]) > 2) fail(`Hash #${id} beim Laden: ${y} statt ${A[id]}`);
    await shot(`laden-${id}`);
  }

  // ---- 3. Tab-Durchlauf ----
  if (tab) {
    await page.goto(url);
    await ready();
    await page.bidi('browsingContext.activate', {context: ctx}).catch(() => {});
    await page.evaluate(() => { window.focus(); document.body.focus(); });
    
    const log = [];
    const total = await page.evaluate(() => document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').length);
    console.log(`Tab-Durchlauf (${total} fokussierbare Elemente im DOM):`);
    let prev = null;
    for (let n = 1; n <= total + 3; n++) {
      await key(TAB);
      await afterKey();
      await page.sleep(1500);
      const d = await describe();
      log.push(d);
      const sig = d.href + '|' + d.text;
      const flags = [];
      if (!d.inView) flags.push('NICHT IM BILD');
      if (d.opacity < 0.9) flags.push(`opacity ${d.opacity}`);
      if (!d.focusVisible) flags.push('KEIN FOKUSRING');
      if (d.tag === 'body') flags.push('Fokus am Anfang (Zyklus zu Ende)');
      console.log(`${String(n).padStart(2)} ${d.tag}${d.id ? '#' + d.id : ''} "${d.text}" ${d.href} y=${d.y} top=${d.top} cam=${d.state.cam.toFixed(2)} ${flags.join(', ')}`);
      if (d.tag === 'body') break;
      if (!d.inView || d.opacity < 0.9 || !d.focusVisible) fail(`Fokus ${n} nicht sichtbar: ${sig}`);
      await shot(`tab-${String(n).padStart(2, '0')}`);
      prev = d;
    }
    fs.writeFileSync(path.join(outDir, 'tab-log.json'), JSON.stringify(log, null, 1));
    // Rückwärts: Shift+Tab von ganz oben endet am letzten Element (kein Trap)
    await key(SHIFT).catch(() => {});
    await page.bidi('input.performActions', {context: ctx, actions: [{type: 'key', id: 'kbd', actions: [
      {type: 'keyDown', value: SHIFT}, {type: 'keyDown', value: TAB}, {type: 'keyUp', value: TAB}, {type: 'keyUp', value: SHIFT}]}]});
    await afterKey();
    await page.sleep(900);
    const b = await describe();
    console.log(`Shift+Tab: ${b.tag} "${b.text}" y=${b.y} inView=${b.inView}`);
    await shot('shift-tab');
    // Rückwärts ein Stück weiter (Zustand folgt dem Scroll)
    for (let k = 0; k < 36; k++) {
      await page.bidi('input.performActions', {context: ctx, actions: [{type: 'key', id: 'kbd', actions: [
        {type: 'keyDown', value: SHIFT}, {type: 'keyDown', value: TAB}, {type: 'keyUp', value: TAB}, {type: 'keyUp', value: SHIFT}]}]});
      await afterKey();
      await page.sleep(900);
      const r = await describe();
      console.log(`Shift+Tab: ${r.tag} "${r.text}" y=${r.y} inView=${r.inView} cam=${r.state.cam.toFixed(2)}`);
      if (!r.inView || r.opacity < 0.9 || !r.focusVisible) fail(`Shift+Tab: ${r.text} nicht sichtbar`);
      if (k % 6 === 5) await shot(`shift-tab-${String(k + 1).padStart(2, '0')}`);
    }
  }

  const problems = [
    ...page.messages.filter((m) => m.type === 'error').map((m) => 'console.error: ' + m.text),
    ...page.errors.map((e) => 'Seitenfehler: ' + e.message),
  ];
  for (const m of page.messages.filter((x) => x.type === 'warning')) console.log('warn: ' + m.text);
  if (problems.length) fail(problems.join('\n'));
} catch (e) { failed = true; console.error(e); }
finally { if (browser) await browser.close(); stop(); }
process.exit(failed ? 1 : 0);
