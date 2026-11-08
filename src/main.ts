import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/labels.css';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
/** ?still / ?state setzen den Zustand fest: dann keine Scroll-Choreografie (contracts/dom.md). */
const fixedState = params.has('still') || params.has('state');

/** Szene nur mit WebGL und ohne reduzierte Bewegung (contracts/dom.md). */
async function initScene(): Promise<void> {
  if (root.classList.contains('reduced') || root.classList.contains('no-webgl')) {
    root.classList.remove('intro');
    return;
  }
  const container = document.getElementById('scene');
  if (!container) {
    root.classList.remove('intro');
    return;
  }
  // Choreografie parallel zur Szene laden; das Hero-Intro startet, sobald sie da ist.
  const choreo = fixedState ? null : import('./choreo/timeline');
  if (choreo) {
    choreo.then((m) => m.playIntro()).catch(() => root.classList.remove('intro'));
  } else root.classList.remove('intro');

  try {
    const { startScene, setState } = await import('./scene');

    // ?state=<json> setzt den Zustand direkt, ?still zeigt die volle Explosion.
    const patch: Record<string, unknown> = {};
    if (params.has('still')) Object.assign(patch, { lid: 1, explode: 1 });
    const raw = params.get('state');
    if (raw) {
      try {
        Object.assign(patch, JSON.parse(raw));
      } catch {
        console.warn('?state: ungültiges JSON');
      }
    }
    // `labels: true` im ?state zeigt alle Labels (nur zum Prüfen)
    const showLabels = params.has('still') || patch.labels === true;
    delete patch.labels;
    if (params.has('still')) root.classList.add('still');
    setState(patch);

    // Container braucht eine Größe vor dem Renderer.
    root.classList.add('scene-on');
    const scene = startScene(container);
    if (showLabels) scene.labels?.show('all');
    void scene.rig.ready.then(() => requestAnimationFrame(() => root.classList.add('scene-ready')));

    if (choreo) await initChoreo(choreo, scene.labels);
  } catch (err) {
    console.warn('Szene nicht verfügbar:', err);
    root.classList.remove('scene-on');
    root.classList.add('no-webgl');
  }
}

/** Scroll-Choreografie; schlägt sie fehl, bleibt die Szene im Hero-Zustand und die Seite normal. */
async function initChoreo(
  choreo: Promise<typeof import('./choreo/timeline')>,
  labels: import('./scene').Labels | null,
): Promise<void> {
  try {
    // T040 hängt das in gsap.matchMedia (desktop / mobile / reduced) ein.
    const [{ createTimeline }, { createSmooth }] = await Promise.all([choreo, import('./choreo/smooth')]);
    const smooth = createSmooth();
    const timeline = createTimeline({
      labels,
      scrollTo: (y) => smooth.scrollTo(y, { immediate: true, force: true }),
    });
    if (window.__v2) {
      window.__v2.marks = () => {
        const m = timeline.marks();
        const s = timeline.score();
        if (!m || !s) return null;
        const out: Record<string, number> = { ...m };
        for (const [k, v] of Object.entries(s.labels)) out[`@${k}`] = v;
        return out;
      };
    }
  } catch (err) {
    console.warn('Scroll-Choreografie nicht verfügbar:', err);
    root.classList.remove('choreo', 'intro');
  }
}

void initScene();
