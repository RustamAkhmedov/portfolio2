// Szene-Screenshots über ?state=<json> (und ?still) mit Firefox.
// Aufruf: node tools/scene-shot.mjs [--no-build] [--cam n,n,...] [--size 1440x900] [--screen n,n,...]
// --states '[{"name":"x","state":{...}}]': eigene Zustände statt der Standardliste
// --screen: nur Display-Stände (explode 1, lid 1, cam 2, screen = Wert) -> screen_<wert>.png
// Ausgabe: test-results/shots/scene/<name>.png; Exit 1 bei Konsolen-/Seitenfehlern.
import {spawn, spawnSync} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let build = true, size = [1440, 900], cams = [0, 1], screens = null, custom = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--no-build') build = false;
  else if (args[i] === '--size') size = args[++i].split('x').map(Number);
  else if (args[i] === '--screen') screens = args[++i].split(',').map(Number);
  else if (args[i] === '--states') custom = JSON.parse(args[++i]); // [{name, state}, ...]
  else if (args[i] === '--cam') cams = args[++i].split(',').map(Number);
}
const states = [];
for (const cam of cams) {
  for (const [lid, ex] of [[0, 0], [1, 0], [1, 0.5], [0, 1], [1, 1]]) {
    states.push({name: `cam${cam}_lid${lid}_ex${String(ex).replace('.', '')}`, state: {lid, explode: ex, cam}});
  }
}
if (screens) {
  states.length = 0;
  for (const sc of screens) states.push({name: `screen_${String(sc).replace('.', '_').replace('-', 'm')}`, state: {explode: 1, lid: 1, cam: 2, screen: sc}});
} else if (custom) { states.length = 0; states.push(...custom); } else states.push({name: 'still', still: true});

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => res(port)); });
});
if (build && spawnSync('npx', ['vite', 'build'], {cwd: root, stdio: 'inherit'}).status !== 0) process.exit(1);
const port = await freePort();
const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* beendet */ } };
process.on('exit', stop);

let browser, failed = false;
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 100) throw new Error('vite preview startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await launch({width: size[0], height: size[1]});
  const page = await browser.newPage();
  await page.setViewport(size[0], size[1], 1);
  const problems = [];
  for (const s of states) {
    page.clearLogs();
    const qs = s.still ? '?still' : '?state=' + encodeURIComponent(JSON.stringify(s.state));
    await page.goto(base + '/' + qs);
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForFunction(() => !!window.__v2, undefined, {timeout: 15000}).catch(() => {});
    const ok = await page.evaluate(async () => {
      if (!window.__v2) return false;
      await window.__v2.ready;
      return true;
    });
    if (!ok) { problems.push(`${s.name}: kein window.__v2 (WebGL/Szene nicht gestartet)`); continue; }
    // nur die Szene zeigen (Text würde den Laptop überdecken)
    await page.evaluate(() => { document.documentElement.classList.add('still'); document.documentElement.style.background = '#E7E3D8'; });
    await page.sleep(700);
    const file = path.join(root, 'test-results/shots/scene', s.name + '.png');
    await page.screenshot({path: file});
    console.log('Screenshot: ' + path.relative(root, file));
    for (const m of page.messages) if (m.type === 'error') problems.push(`${s.name}: console.error: ${m.text}`);
    for (const e of page.errors) problems.push(`${s.name}: Seitenfehler: ${e.message}`);
  }
  if (problems.length) { failed = true; console.error(problems.join('\n')); }
} catch (e) { failed = true; console.error(e); }
finally { if (browser) await browser.close(); stop(); }
process.exit(failed ? 1 : 0);
