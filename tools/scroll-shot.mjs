// Scroll-Choreografie prüfen (T030): Dev-Server + Firefox (ffbrowser.mjs, nie Chrome), scrollt zu den
// Marken der Timeline (window.__v2.marks()), macht je Station einen Screenshot, liest window.__v2.state
// und misst beim Durchscrollen die Bildrate (headless = nur Richtwert).
// Aufruf: node tools/scroll-shot.mjs [--size 1440x900] [--lang de|en] [--no-fps] [--settle ms]
// Ausgabe: test-results/shots/scroll/<lang>/<nr>-<name>@<breite>.png + state@<breite>.json; Exit 1 bei Konsolen-/Seitenfehlern.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let size = [1440, 900], lang = 'de', fps = true, settle = 1400;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') size = args[++i].split('x').map(Number);
  else if (args[i] === '--lang') lang = args[++i];
  else if (args[i] === '--no-fps') fps = false;
  else if (args[i] === '--settle') settle = Number(args[++i]);
  else { console.error('Unbekanntes Argument: ' + args[i]); process.exit(2); }
}
const outDir = path.join(root, 'test-results/shots/scroll', lang);

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

/** Stationen aus den Marken: [Name, Scroll-Position] */
function stations(m) {
  const step = (m.stepsEnd - m.projEnd) / 6;
  const list = [
    ['hero', 0],
    ['lid-halb', m.lidEnd / 2],
    ['lid-offen', m.lidEnd],
    ['explosion-halb', (m.lidEnd + m.explodeEnd) / 2],
    ['explosion', m.explodeEnd],
    ['stueckliste', m.rowsEnd],
    ['projekte-rein', (m.projStart + m.projEnd) / 2],
  ];
  for (let i = 0; i < 6; i++) list.push([`projekt-${i + 1}`, m.projEnd + (i + 0.5) * step]);
  list.push(['wechsel-1-2', m.projEnd + step]);
  list.push(['verzeichnis', m.stepsEnd + 0.6 * m.vh]);
  return list.map(([n, y]) => [n, Math.round(y)]);
}

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
  await page.goto(base + (lang === 'en' ? '/en/' : '/'));
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForFunction(() => !!(window.__v2 && window.__v2.marks && window.__v2.marks()), undefined, {timeout: 30000});
  await page.evaluate(async () => { await window.__v2.ready; await document.fonts.ready; });
  await page.sleep(1500); // Intro + refresh nach Schriften

  const marks = await page.evaluate(() => window.__v2.marks());
  console.log('Marken (px):', JSON.stringify(marks));
  const doc = await page.evaluate(() => ({h: document.documentElement.scrollHeight, vh: innerHeight}));
  console.log(`Dokument ${doc.h}px, Viewport ${doc.vh}px`);

  fs.mkdirSync(outDir, {recursive: true});
  const report = {size, lang, marks, stations: []};
  const list = stations(marks);
  for (let k = 0; k < list.length; k++) {
    const [name, y] = list[k];
    await page.evaluate((top) => window.scrollTo({top, behavior: 'instant'}), y);
    await page.sleep(settle);
    const info = await page.evaluate(() => {
      const s = window.__v2.state;
      const vis = [...document.querySelectorAll('[data-step]')].map((el) => Number(getComputedStyle(el).opacity).toFixed(2));
      const rows = [...document.querySelectorAll('#bom tbody tr')].map((el) => Number(getComputedStyle(el).opacity).toFixed(2));
      const labels = [...document.querySelectorAll('#labels .label')].map((el) => Number(el.style.opacity || 0).toFixed(2));
      return {scrollY: Math.round(scrollY), state: {...s}, steps: vis.join(' '), rows: rows.join(' '), labels: labels.join(' ')};
    });
    const file = path.join(outDir, `${String(k).padStart(2, '0')}-${name}@${size[0]}.png`);
    await page.screenshot({path: file});
    const st = info.state;
    console.log(`${name.padEnd(15)} y=${String(info.scrollY).padStart(5)}  lid=${st.lid.toFixed(2)} explode=${st.explode.toFixed(2)} cam=${st.cam.toFixed(2)} ` +
      `screen=${st.screen.toFixed(2)} focus=${st.focus} | steps ${info.steps} | rows ${info.rows} | labels ${info.labels}`);
    report.stations.push({name, y, ...info, file: path.relative(root, file)});
  }

  // Verzeichnis-Hover (T035): synthetisches pointerover auf die 3. Zeile, screen muss Index 8 sein
  {
    const y = list.find(([n]) => n === 'verzeichnis')[1];
    await page.evaluate((top) => window.scrollTo({top, behavior: 'instant'}), y);
    await page.sleep(settle);
    const hov = await page.evaluate(() => {
      const row = document.querySelectorAll('#projekte-alle [data-project]')[2];
      if (!row) return null;
      const before = window.__v2.state.screen;
      row.dispatchEvent(new Event('pointerover', {bubbles: true}));
      return {name: row.dataset.project, before, after: window.__v2.state.screen};
    });
    await page.sleep(settle);
    const file = path.join(outDir, `${String(list.length).padStart(2, '0')}-verzeichnis-hover@${size[0]}.png`);
    await page.screenshot({path: file});
    console.log('Verzeichnis-Hover:', JSON.stringify(hov));
    report.hover = hov;
    await page.evaluate(() => document.querySelectorAll('#projekte-alle [data-project]')[2]?.dispatchEvent(new Event('pointerout', {bubbles: true})));
  }

  // Rückwärts-Sprung (Pos1): Zustand muss sofort wieder Hero sein
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  await page.sleep(300);
  const back = await page.evaluate(() => ({...window.__v2.state}));
  console.log('Pos1 nach 300 ms:', JSON.stringify(back));
  report.home = back;
  if (back.explode !== 0 || back.cam !== 0) { console.error('Pos1: Zustand nicht zurückgesetzt'); failed = true; }

  if (fps) {
    // Gleichmäßig durchscrollen (wie Mausrad/Lenis), Browser-Frames und gezeichnete Frames zählen
    const res = await page.evaluate(async (end) => {
      const frames = []; const drawn = [];
      const t0 = performance.now();
      const dur = 9000;
      await new Promise((done) => {
        function tick(now) {
          frames.push(now);
          const p = Math.min(1, (now - t0) / dur);
          window.scrollTo({top: p * end, behavior: 'instant'});
          drawn.push(window.__v2.fps());
          if (p < 1) requestAnimationFrame(tick); else done();
        }
        requestAnimationFrame(tick);
      });
      const gaps = frames.slice(1).map((t, i) => t - frames[i]);
      const mean = (gaps.length * 1000) / (frames[frames.length - 1] - frames[0]);
      // schlechtestes 500-ms-Fenster
      let worst = Infinity;
      for (let i = 0, j = 0; i < frames.length; i++) {
        while (j < frames.length && frames[j] - frames[i] < 500) j++;
        if (j >= frames.length) break;
        worst = Math.min(worst, ((j - i) * 1000) / (frames[j] - frames[i]));
      }
      const longest = Math.max(...gaps);
      const d = drawn.filter((x) => x > 0);
      return {mean, worst500: worst, longestFrameMs: longest, sceneFpsMedian: d.sort((a, b) => a - b)[d.length >> 1] ?? 0};
    }, marks.stepsEnd + marks.vh);
    console.log(`fps (headless, Richtwert): Mittel ${res.mean.toFixed(1)}, schlechtestes 500-ms-Fenster ${res.worst500.toFixed(1)}, ` +
      `längster Frame ${res.longestFrameMs.toFixed(1)} ms, Szene (Median __v2.fps) ${res.sceneFpsMedian.toFixed(1)}`);
    report.fps = res;
  }

  fs.writeFileSync(path.join(outDir, `state@${size[0]}.json`), JSON.stringify(report, null, 2));
  const problems = [
    ...page.messages.filter((m) => m.type === 'error').map((m) => 'console.error: ' + m.text),
    ...page.errors.map((e) => 'Seitenfehler: ' + e.message),
  ];
  for (const m of page.messages.filter((x) => x.type === 'warning')) console.log('warn: ' + m.text);
  if (problems.length) { failed = true; console.error(problems.join('\n')); }
} catch (e) { failed = true; console.error(e); }
finally { if (browser) await browser.close(); stop(); }
process.exit(failed ? 1 : 0);
