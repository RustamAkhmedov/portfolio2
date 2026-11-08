// Performance-Messung der Szene (T034, Constitution III): Firefox (ffbrowser.mjs, nie Chrome) scrollt
// gleichmäßig (rAF-getaktete Schritte) von Hero bis Verzeichnis und misst je Frame:
//   Bildintervall, gezeichnet ja/nein, Draw-Calls/Dreiecke/Linien, Programm-Wechsel (WebGL-Hooks),
//   JS-Zeit der rAF-Callbacks (gesamt und im Render-Callback = render + labels.update),
//   Texturspeicher (Schätzung aus texStorage2D/texImage2D, RGBA8), Ruhe-Frames (Constitution: 0 Renders).
// Die Hooks hängen per Preload-Skript am WebGL-Prototyp, gehen also auch im Produktions-Build ohne __v2.
//
// Aufruf: node tools/perf.mjs [--prod] [--headed] [--size 1440x900] [--dpr 1] [--dur 12000] [--lang de]
//                             [--wheel] [--warm] [--quick] [--no-probe] [--json out.json]
//   --wheel   echte Mausrad-Ereignisse (BiDi input, durch Lenis) statt scrollTo je Frame
//   --quick   nicht auf das Ende der Firefox-Starthintergrundarbeit warten (siehe unten)
//   --warm    vorher wie scroll-shot alle Stationen anspringen + Verzeichnis-Hover, dann Pos1 (300 ms)
//   --prod    vite build + vite preview statt Dev-Server (Stationen/GPU-Probe brauchen Dev, dort fehlen sie)
//   --headed  normales Firefox-Fenster statt headless (DPR kommt dann vom Bildschirm, wenn --dpr fehlt)
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from './ffbrowser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let quick = false, warm = false, wheel = false, size = [1440, 900], dpr = null, dur = 12000, lang = 'de', prod = false, headed = false, probe = true, jsonOut = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--size') size = args[++i].split('x').map(Number);
  else if (a === '--dpr') dpr = Number(args[++i]);
  else if (a === '--dur') dur = Number(args[++i]);
  else if (a === '--lang') lang = args[++i];
  else if (a === '--prod') prod = true;
  else if (a === '--wheel') wheel = true;
  else if (a === '--warm') warm = true;
  else if (a === '--quick') quick = true;
  else if (a === '--headed') headed = true;
  else if (a === '--no-probe') probe = false;
  else if (a === '--json') jsonOut = args[++i];
  else { console.error('Unbekanntes Argument: ' + a); process.exit(2); }
}
if (dpr === null && !headed) dpr = 1;
// Fenster-Modus: --size ist die Fenstergröße (äußere Maße), der Viewport ist kleiner (Werkzeugleisten)

// ---------- Hooks im Browser (vor allen Seiten-Skripten) ----------
const PRELOAD = String(() => {
  const P = (window.__perf = {frames: [], cur: null, finish: false, texBytes: 0, texCount: 0, gl: null, rawRaf: null});
  const now = () => performance.now();
  P.rawRaf = window.requestAnimationFrame.bind(window);
  const newFrame = (t) => {
    P.cur = {t, cb: 0, drawCb: 0, draws: 0, tris: 0, lines: 0, programs: 0, finish: 0, upload: 0, compile: 0, layout: 0, drawMs: 0, newProg: 0};
    P.frames.push(P.cur);
    if (P.frames.length > 30000) P.frames.shift();
  };
  window.requestAnimationFrame = (cb) => P.rawRaf((ts) => {
    if (!P.cur || P.cur.t !== ts) newFrame(ts);
    const f = P.cur;
    const d0 = f.draws;
    const t0 = now();
    try { cb(ts); } finally {
      const t1 = now();
      if (P.finish && f.draws > d0 && P.gl) { P.gl.finish(); f.finish += now() - t1; }
      const dt = t1 - t0;
      f.cb += dt;
      if (f.draws > d0) f.drawCb += dt;
    }
  });
  // Erzwungenes Layout (Lesen von Maßen nach DOM-Schreiben) je Frame
  for (const [proto, prop] of [[Element.prototype, 'clientWidth'], [Element.prototype, 'clientHeight'], [HTMLElement.prototype, 'offsetWidth'], [HTMLElement.prototype, 'offsetHeight']]) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.get) continue;
    Object.defineProperty(proto, prop, {...d, get() { const t0 = now(); try { return d.get.call(this); } finally { if (P.cur) P.cur.layout += now() - t0; } }});
  }
  const gbcr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { const t0 = now(); try { return gbcr.call(this); } finally { if (P.cur) P.cur.layout += now() - t0; } };
  const count = (mode, n, inst) => {
    const f = P.cur;
    if (!f) return;
    f.draws++;
    if (mode === 4) f.tris += (n / 3) * inst;
    else if (mode === 1) f.lines += (n / 2) * inst;
  };
  const texSize = new WeakMap();
  const bound = new Map();
  let unit = 0;
  const setBytes = (gl, target, bytes) => {
    const t = bound.get(unit + ':' + target);
    if (!t) return;
    const old = texSize.get(t);
    if (old === undefined) P.texCount++;
    P.texBytes += bytes - (old || 0);
    texSize.set(t, bytes);
  };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    const wrap = (name, before) => {
      const orig = p[name];
      if (!orig) return;
      p[name] = function (...a) { before.call(this, a); return orig.apply(this, a); };
    };
    wrap('drawElements', function (a) { P.gl = this; count(a[0], a[1], 1); });
    wrap('drawArrays', function (a) { P.gl = this; count(a[0], a[2], 1); });
    wrap('drawElementsInstanced', function (a) { P.gl = this; count(a[0], a[1], a[4]); });
    wrap('drawArraysInstanced', function (a) { P.gl = this; count(a[0], a[2], a[3]); });
    wrap('useProgram', () => { if (P.cur) P.cur.programs++; });
    wrap('activeTexture', function (a) { unit = a[0] - this.TEXTURE0; });
    wrap('bindTexture', (a) => { bound.set(unit + ':' + a[0], a[1]); });
    wrap('texStorage2D', function (a) {
      const [target, levels, , w, h] = a;
      setBytes(this, target, w * h * 4 * (levels > 1 ? 4 / 3 : 1));
    });
    wrap('texImage2D', function (a) {
      if (a[1] !== 0) return; // nur Level 0 zählen
      let w, h;
      if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s?.width ?? s?.videoWidth ?? 0; h = s?.height ?? s?.videoHeight ?? 0; }
      setBytes(this, a[0], w * h * 4);
    });
    wrap('generateMipmap', function (a) {
      const t = bound.get(unit + ':' + a[0]);
      const b = t && texSize.get(t);
      if (b) setBytes(this, a[0], Math.round(b * 4 / 3));
    });
    // Zeit für Textur-Uploads und Shader-Linken je Frame
    const timed = (name, field) => {
      const orig = p[name];
      if (!orig) return;
      p[name] = function (...a) { const t0 = now(); try { return orig.apply(this, a); } finally { if (P.cur) P.cur[field] += now() - t0; } };
    };
    for (const n of ['texImage2D', 'texSubImage2D', 'texStorage2D', 'generateMipmap']) timed(n, 'upload');
    for (const n of ['linkProgram', 'getProgramParameter', 'compileShader']) timed(n, 'compile');
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) timed(n, 'drawMs');
    wrap('createProgram', () => { if (P.cur) P.cur.newProg++; });
    wrap('deleteTexture', (a) => {
      const b = texSize.get(a[0]);
      if (b !== undefined) { P.texBytes -= b; P.texCount--; texSize.delete(a[0]); }
    });
  }
});

// ---------- Auswertung ----------
const q = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
function summarize(frames) {
  if (frames.length < 3) return null;
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
  const span = frames[frames.length - 1].t - frames[0].t;
  const drawn = frames.filter((f) => f.draws > 0);
  let worst = Infinity;
  for (let i = 0, j = 0; i < frames.length; i++) {
    while (j < frames.length && frames[j].t - frames[i].t < 500) j++;
    if (j >= frames.length) break;
    worst = Math.min(worst, ((j - i) * 1000) / (frames[j].t - frames[i].t));
  }
  return {
    frames: frames.length,
    browserFps: (gaps.length * 1000) / span,
    // wie drawnFps (renderer.ts): Abstände gezeichneter Frames, Ruhepausen > 100 ms zählen nicht
    sceneFps: (() => {
      const g = drawn.slice(1).map((f, i) => f.t - drawn[i].t).filter((x) => x > 0 && x <= 100);
      return g.length ? (g.length * 1000) / g.reduce((a, b) => a + b, 0) : 0;
    })(),
    drawnShare: drawn.length / frames.length,
    worst500: worst === Infinity ? 0 : worst,
    gapP50: q(gaps, 0.5), gapP95: q(gaps, 0.95), gapP99: q(gaps, 0.99), gapMax: Math.max(...gaps),
    gaps25: gaps.filter((g) => g > 25).length, gaps50: gaps.filter((g) => g > 50).length,
    cbP50: q(frames.map((f) => f.cb), 0.5), cbP95: q(frames.map((f) => f.cb), 0.95), cbMax: Math.max(...frames.map((f) => f.cb)),
    drawCbP50: q(drawn.map((f) => f.drawCb), 0.5), drawCbP95: q(drawn.map((f) => f.drawCb), 0.95),
    drawCbMax: drawn.length ? Math.max(...drawn.map((f) => f.drawCb)) : 0,
    otherCbP50: q(frames.map((f) => f.cb - f.drawCb), 0.5), otherCbP95: q(frames.map((f) => f.cb - f.drawCb), 0.95),
    layoutP50: q(frames.map((f) => f.layout), 0.5), layoutP95: q(frames.map((f) => f.layout), 0.95), layoutMax: Math.max(...frames.map((f) => f.layout)),
    drawsMax: Math.max(0, ...drawn.map((f) => f.draws)), drawsP50: q(drawn.map((f) => f.draws), 0.5),
    trisMax: Math.max(0, ...drawn.map((f) => f.tris)), linesMax: Math.max(0, ...drawn.map((f) => f.lines)),
    programsP50: q(drawn.map((f) => f.programs), 0.5),
  };
}
const f1 = (x) => (typeof x === 'number' ? x.toFixed(1) : String(x));

// ---------- Server ----------
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.once('error', rej);
  s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => res(port)); });
});
if (prod && spawnSync('npx', ['vite', 'build'], {cwd: root, stdio: 'inherit'}).status !== 0) process.exit(1);
const port = await freePort();
const server = spawn('npx', ['vite', ...(prod ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true});
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* beendet */ } };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

let browser, failed = false, launchedAt = Date.now();
const report = {date: new Date().toISOString(), mode: prod ? 'prod' : 'dev', headed, wheel, size, dpr, dur, lang};
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/')).ok) break; } catch { /* warten */ }
    if (i > 150) throw new Error('vite startet nicht');
    await new Promise((r) => setTimeout(r, 100));
  }
  // Feine Zeitmessung (Firefox rundet performance.now sonst auf 1 ms); ändert sonst nichts am Rendern.
  launchedAt = Date.now();
  browser = await launch({width: size[0], height: size[1], headless: !headed, deviceScaleFactor: dpr,
    prefs: {'privacy.reduceTimerPrecision': false, 'privacy.resistFingerprinting.reduceTimerPrecision.microseconds': 1,
      // Fenster: --dpr setzt die Firefox-Skalierung (layout.css.devPixelsPerPx), sonst die des Bildschirms
      ...(headed && dpr !== null ? {'layout.css.devPixelsPerPx': String(dpr)} : {})}});
  const page = await browser.newPage();
  // dpr null (Fenster ohne --dpr): Bildschirm-DPR behalten (BiDi: devicePixelRatio null = nicht emulieren)
  if (!headed) await page.setViewport(size[0], size[1], dpr).catch(() => {});
  await page.addPreloadScript(PRELOAD);
  page.clearLogs();
  await page.goto(base + (lang === 'en' ? '/en/' : '/'));
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForFunction(() => document.documentElement.classList.contains('scene-ready') || document.documentElement.classList.contains('no-webgl'),
    undefined, {timeout: 30000});
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.sleep(2500); // Intro, refresh nach Schriften

  const env = await page.evaluate(() => {
    const c = document.querySelector('#scene canvas');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ua: navigator.userAgent, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight,
      canvas: c ? [c.width, c.height] : null,
      gl: gl ? gl.getParameter(gl.VERSION) : null,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
      antialias: gl ? gl.getContextAttributes().antialias : null,
      samples: gl ? gl.getParameter(gl.SAMPLES) : null,
      choreo: document.documentElement.classList.contains('choreo'),
      hasV2: !!window.__v2,
      longtask: typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes || []).includes('longtask'),
    };
  });
  report.env = env;
  console.log('Umgebung:', JSON.stringify(env));
  if (!env.choreo) throw new Error('Choreografie nicht aktiv');

  // Scroll-Ende: Projektverzeichnis + 0,6 Viewport (wie scroll-shot „verzeichnis“)
  const end = await page.evaluate(() => {
    const el = document.getElementById('projekte-alle');
    return Math.round(el.getBoundingClientRect().top + scrollY + 0.6 * innerHeight);
  });
  report.scrollEnd = end;

  // Ruhe vor dem Scrollen (Hero, Intro vorbei): wie viele Frames zeichnen?
  const idleBefore = await page.evaluate(async () => {
    const P = window.__perf; const n0 = P.frames.length;
    await new Promise((r) => setTimeout(r, 2000));
    const fr = P.frames.slice(n0);
    return {frames: fr.length, drawn: fr.filter((f) => f.draws > 0).length};
  });

  if (warm) {
    await page.evaluate(async ({end, mode}) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!mode.includes('nojumps')) for (let k = 1; k <= 14; k++) { window.scrollTo({top: Math.round((k / 14) * end), behavior: 'instant'}); await wait(1000); }
      else { window.scrollTo({top: end, behavior: 'instant'}); await wait(1500); }
      if (!mode.includes('nohover')) {
        const row = document.querySelectorAll('#projekte-alle [data-project]')[2];
        row?.dispatchEvent(new Event('pointerover', {bubbles: true}));
        await wait(1000);
        row?.dispatchEvent(new Event('pointerout', {bubbles: true}));
      }
      window.scrollTo({top: 0, behavior: 'instant'});
      await wait(mode.includes('longpause') ? 4000 : 300);
    }, {end, mode: process.env.WARM || ''});
  }

  // Ein frisches Firefox-Profil erledigt ca. 30 s nach dem Start Hintergrundarbeit, die einen einzelnen
  // Frame um 66–93 ms verlängert – unabhängig von Seite, Scroll-Stelle und JS (gemessen 2026-11-08). Erst
  // danach messen, sonst landet dieser Ausreißer zufällig in der Messung.
  if (!quick) {
    const wait = launchedAt + 36000 - Date.now();
    if (wait > 0) { console.log(`warte ${Math.round(wait / 1000)} s auf das Ende der Firefox-Startarbeiten (--quick überspringt)`); await page.sleep(wait); }
  }

  // Durchscrollen. Standard: gleichmäßig, eine Position je Browser-Frame (eigene rAF, nicht mitgemessen).
  // --wheel: echte Mausrad-Ereignisse (BiDi input, 100 px je Raste) → Lenis glättet wie beim Nutzer.
  await page.evaluate(async (warm) => {
    const P = window.__perf;
    if (!warm) {
      window.scrollTo({top: 0, behavior: 'instant'});
      await new Promise((r) => setTimeout(r, 800));
    }
    P.n0 = P.frames.length; P.tex0 = P.texBytes; P.texMax = P.texBytes; P.v2 = []; P.t0 = performance.now(); P.sampling = true;
    const sample = () => {
      if (!P.sampling) return;
      if (window.__v2) P.v2.push(window.__v2.fps());
      P.texMax = Math.max(P.texMax, P.texBytes);
      P.rawRaf(sample);
    };
    P.rawRaf(sample);
  }, warm);
  if (wheel) {
    const ctxId = (await page.bidi('browsingContext.getTree', {})).contexts[0].context;
    const notches = Math.ceil(end / 100);
    const pause = Math.round(dur / notches);
    const actions = [];
    for (let i = 0; i < notches; i++) {
      actions.push({type: 'scroll', x: Math.round(size[0] * 0.6), y: 300, deltaX: 0, deltaY: 100, duration: 0});
      actions.push({type: 'pause', duration: pause});
    }
    await page.bidi('input.performActions', {context: ctxId, actions: [{type: 'wheel', id: 'rad', actions}]});
  } else {
    await page.evaluate(async ({end, dur}) => {
      const P = window.__perf;
      await new Promise((done) => {
        function tick(now) {
          const p = Math.min(1, (now - P.t0) / dur);
          window.scrollTo({top: p * end, behavior: 'instant'});
          if (p < 1) P.rawRaf(tick); else done();
        }
        P.rawRaf(tick);
      });
    }, {end, dur});
  }
  const run = await page.evaluate(async () => {
    const P = window.__perf;
    P.sampling = false;
    const runFrames = P.frames.slice(P.n0);
    const reached = Math.round(scrollY);
    // Nachlauf (Lenis + Scrub 0,6 s) abwarten, dann Ruhe messen
    await new Promise((r) => setTimeout(r, 2500));
    const n1 = P.frames.length;
    await new Promise((r) => setTimeout(r, 2000));
    const idle = P.frames.slice(n1);
    return {
      frames: runFrames, v2: P.v2, reached,
      idle: {frames: idle.length, drawn: idle.filter((f) => f.draws > 0).length},
      texBefore: P.tex0, texMax: P.texMax, texAfter: P.texBytes, texCount: P.texCount,
    };
  });
  report.reached = run.reached;
  const sum = summarize(run.frames);
  const v2 = run.v2.filter((x) => x > 0);
  report.run = {...sum, v2Median: q(v2, 0.5), v2P10: q(v2, 0.1), v2Mean: v2.length ? v2.reduce((a, b) => a + b, 0) / v2.length : 0,
    idleBefore, idleAfter: run.idle, texMB: {before: run.texBefore / 1048576, max: run.texMax / 1048576, after: run.texAfter / 1048576}, texCount: run.texCount};
  // Schlechteste Stellen (Scroll-Anteil), damit man weiß, wo es hakt
  const t0 = run.frames[0]?.t ?? 0;
  report.run.slowFrames = run.frames.slice(1).map((f, i) => ({at: (f.t - t0) / dur, gap: f.t - run.frames[i].t, cb: run.frames[i + 1].cb, draws: f.draws}))
    .filter((x) => x.gap > 25).slice(0, 12).map((x) => `${(x.at * 100).toFixed(0)}%:${x.gap.toFixed(0)}ms(JS ${x.cb.toFixed(1)}, ${x.draws ? 'gezeichnet' : 'ohne Render'})`);

  // teuerste Frames (JS-Zeit), mit Stelle der Strecke
  report.run.heavyFrames = run.frames.map((f) => ({at: (f.t - t0) / dur, cb: f.cb, drawCb: f.drawCb, upload: f.upload, compile: f.compile, layout: f.layout, drawMs: f.drawMs, newProg: f.newProg}))
    .sort((a, b) => b.cb - a.cb).slice(0, 6)
    .map((x) => `${(x.at * 100).toFixed(0)}%:${x.cb.toFixed(1)}ms${x.layout > 0.05 ? ` [Layout ${x.layout.toFixed(1)}]` : ''}${x.drawCb > 0 ? `(render ${x.drawCb.toFixed(1)}` +
      `${x.upload > 0.05 ? `, Upload ${x.upload.toFixed(1)}` : ''}${x.compile > 0.05 ? `, Shader ${x.compile.toFixed(1)}` : ''}, Draw ${x.drawMs.toFixed(1)}${x.newProg ? `, ${x.newProg} neue Programme` : ''})` : ''}`);
  // Anteil gezeichneter Frames je Zehntel der Strecke
  report.run.drawnByTenth = Array.from({length: 10}, (_, k) => {
    const fr = run.frames.filter((f) => Math.min(9, Math.floor(((f.t - t0) / dur) * 10)) === k);
    return fr.length ? Math.round((100 * fr.filter((f) => f.draws > 0).length) / fr.length) : 0;
  });
  report.run.pattern = run.frames.map((f) => (f.draws > 0 ? '1' : '.')).join('');
  const r = report.run;
  console.log(`\nDurchscrollen ${dur} ms bis y=${end}${wheel ? ` per Mausrad (erreicht ${run.reached})` : ''} (${prod ? 'Prod' : 'Dev'}, ${headed ? 'Fenster' : 'headless'}, ${size.join('x')} @${env.dpr}, Canvas ${env.canvas?.join('x')})`);
  console.log(`  Browser-fps ${f1(r.browserFps)} | Szene-fps in Bewegung ${f1(r.sceneFps)} (gezeichnet ${(r.drawnShare * 100).toFixed(0)} %) | __v2.fps ${env.hasV2 ? `Median ${f1(r.v2Median)} P10 ${f1(r.v2P10)} Mittel ${f1(r.v2Mean)}` : '– (Prod ohne Test-Hook)'}`);
  console.log(`  schlechtestes 500-ms-Fenster ${f1(r.worst500)} fps | Intervall P50 ${f1(r.gapP50)} P95 ${f1(r.gapP95)} P99 ${f1(r.gapP99)} max ${f1(r.gapMax)} ms | >25 ms: ${r.gaps25}, >50 ms: ${r.gaps50}`);
  console.log(`  JS/Frame P50 ${f1(r.cbP50)} P95 ${f1(r.cbP95)} max ${f1(r.cbMax)} ms | Render-Callback (render+labels) P50 ${f1(r.drawCbP50)} P95 ${f1(r.drawCbP95)} max ${f1(r.drawCbMax)} | Rest (GSAP/Lenis/applyState) P50 ${f1(r.otherCbP50)} P95 ${f1(r.otherCbP95)}`);
  console.log(`  erzwungenes Layout (clientWidth/offset*/getBoundingClientRect) je Frame P50 ${f1(r.layoutP50)} P95 ${f1(r.layoutP95)} max ${f1(r.layoutMax)} ms`);
  console.log(`  Draw-Calls max ${r.drawsMax} (P50 ${r.drawsP50}), Dreiecke max ${Math.round(r.trisMax)}, Linien max ${Math.round(r.linesMax)}, Programme/Frame P50 ${r.programsP50}`);
  console.log(`  Texturen ${r.texCount}, ~${f1(r.texMB.before)} → max ${f1(r.texMB.max)} → ${f1(r.texMB.after)} MB | Ruhe vorher ${idleBefore.drawn}/${idleBefore.frames} Frames gezeichnet, nachher ${run.idle.drawn}/${run.idle.frames}`);
  console.log('  gezeichnet je Zehntel der Strecke (%): ' + r.drawnByTenth.join(' '));
  console.log('  teuerste Frames (JS): ' + r.heavyFrames.join(' '));
  if (r.slowFrames.length) console.log('  lange Frames: ' + r.slowFrames.join(' '));

  // Stationen + GPU-Probe (nur Dev: braucht __v2.marks und /src/scene/state.ts für requestRender)
  if (!prod && probe && env.hasV2) {
    const marks = await page.evaluate(() => window.__v2.marks());
    const step = (marks.stepsEnd - marks.projEnd) / 6;
    const st = [['hero', 0], ['totale', marks.explodeEnd], ['stueckliste', marks.rowsEnd], ['projekt-3', marks.projEnd + 2.5 * step], ['verzeichnis', end]];
    report.stations = [];
    console.log('\nStationen (letzter gezeichneter Frame; GPU-Probe: 90 erzwungene Frames mit gl.finish)');
    for (const [name, y] of st) {
      await page.evaluate((top) => window.scrollTo({top: Math.round(top), behavior: 'instant'}), y);
      await page.sleep(1800);
      const s = await page.evaluate(async () => {
        const P = window.__perf;
        const {requestRender} = await import('/src/scene/state.ts');
        const last = [...P.frames].reverse().find((f) => f.draws > 0);
        P.finish = true;
        const n0 = P.frames.length;
        await new Promise((done) => {
          let k = 0;
          const tick = () => { requestRender(); if (++k < 90) P.rawRaf(tick); else done(); };
          P.rawRaf(tick);
        });
        await new Promise((r) => setTimeout(r, 100));
        P.finish = false;
        const fr = P.frames.slice(n0).filter((f) => f.draws > 0);
        const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
        const gaps = fr.slice(1).map((f, i) => f.t - fr[i].t);
        return {
          draws: last?.draws, tris: Math.round(last?.tris ?? 0), lines: Math.round(last?.lines ?? 0), programs: last?.programs,
          renderMs: med(fr.map((f) => f.drawCb)), gpuWaitMs: med(fr.map((f) => f.finish)), forcedFps: gaps.length ? 1000 / med(gaps) : 0,
          state: {...window.__v2.state},
        };
      });
      report.stations.push({name, y: Math.round(y), ...s});
      console.log(`  ${name.padEnd(12)} Draw-Calls ${s.draws}, Dreiecke ${s.tris}, Linien ${s.lines}, Programme ${s.programs} | ` +
        `Render-CB ${f1(s.renderMs)} ms + gl.finish ${f1(s.gpuWaitMs)} ms, erzwungen ${f1(s.forcedFps)} fps`);
    }
  }

  const problems = [
    ...page.messages.filter((m) => m.type === 'error').map((m) => 'console.error: ' + m.text),
    ...page.errors.map((e) => 'Seitenfehler: ' + e.message),
  ];
  for (const m of page.messages.filter((x) => x.type === 'warning')) console.log('warn: ' + m.text);
  if (problems.length) { failed = true; console.error(problems.join('\n')); }
} catch (e) { failed = true; console.error(e); }
finally {
  if (jsonOut) { fs.mkdirSync(path.dirname(path.resolve(jsonOut)), {recursive: true}); fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2)); }
  if (browser) await browser.close();
  stop();
}
process.exit(failed ? 1 : 0);
