import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/labels.css';
import * as st from './scene/state';
import './styles/reduced.css';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
/** ?still / ?state setzen den Zustand fest: dann keine Scroll-Choreografie (contracts/dom.md). */
const fixedState = params.has('still') || params.has('state');

/** Szene nur mit WebGL; Medienfälle (desktop / mobile / reduced) verwaltet choreo/media.ts (T040). */
async function initScene(): Promise<void> {
  const container = document.getElementById('scene');
  if (root.classList.contains('no-webgl') || !container) {
    root.classList.remove('intro');
    return;
  }
  if (fixedState) {
    if (root.classList.contains('reduced')) {
      root.classList.remove('intro');
      return;
    }
    await startFixed(container);
    return;
  }

  type Loaded = { handle: import('./scene').SceneHandle } | null;
  let scene: Promise<Loaded> | null = null;
  let current: Loaded = null;
  const load = (): Promise<Loaded> => {
    scene ??= (async () => {
      try {
        const mod = await import('./scene');
        root.classList.add('scene-on'); // Container braucht eine Größe vor dem Renderer
        st.trackCompact();
        const handle = mod.startScene(container);
        void handle.rig.ready.then(() => requestAnimationFrame(() => root.classList.add('scene-ready')));
        return { handle };
      } catch (err) {
        console.warn('Szene nicht verfügbar:', err);
        root.classList.remove('scene-on');
        root.classList.add('no-webgl');
        return null;
      }
    })();
    return scene;
  };

  let smoothRef: import('./choreo/smooth').Smooth | null = null;
  const { initMedia } = await import('./choreo/media');
  initMedia({
    async showScene() {
      const first = !scene;
      current = await load();
      if (!current) return false;
      if (!first) {
        root.classList.add('scene-on', 'scene-ready');
        current.handle.rig.start();
      }
      return true;
    },
    hideScene() {
      current?.handle.rig.stop();
      root.classList.remove('scene-on', 'scene-ready');
    },
    resetState() {
      st.setState({ lid: 0, explode: 0, cam: 0, focusMix: 0, screen: -1, focus: null });
    },
    async playIntro() {
      return (await import('./choreo/timeline')).playIntro();
    },
    async createSmooth() {
      const smooth = (await import('./choreo/smooth')).createSmooth();
      smoothRef = smooth;
      return smooth;
    },
    async createTimeline({ mobile, scrollTo }) {
      const { createTimeline } = await import('./choreo/timeline');
      const { DESKTOP, MOBILE } = await import('./choreo/score');
      const timeline = createTimeline({
        labels: current?.handle.labels ?? null,
        scrollTo: (y) => scrollTo(y),
        lengths: mobile ? MOBILE : DESKTOP,
        // Handy: Szene ist die Bühne oben (layout.css), Hero und Projekte pinnen darunter
        stageTop: mobile ? () => container.getBoundingClientRect().height : undefined,
      });
      // Anker (#id) landen auf der Scroll-Position des Abschnitts, nicht auf seinem DOM-Abstand
      smoothRef?.setResolver((id) => timeline.anchorY(id));
      if (window.__v2) {
        window.__v2.marks = () => {
          const m = timeline.marks();
          const s = timeline.score();
          if (!m || !s) return null;
          const { sections, ...flat } = m;
          const out: Record<string, number> = { ...flat };
          sections.forEach((sec, i) => {
            out[`sec${i}In`] = sec.inStart;
            out[`sec${i}Pin`] = sec.pinStart;
            out[`sec${i}End`] = sec.pinEnd;
          });
          for (const [k, v] of Object.entries(s.labels)) out[`@${k}`] = v;
          return out;
        };
      }
      return {
        kill() {
          smoothRef?.setResolver(null);
          timeline.kill();
          if (window.__v2) window.__v2.marks = () => null;
        },
      };
    },
    async createDirectory() {
      const [{ createDirectory }, { screenIndexOf }] = await Promise.all([
        import('./choreo/directory'),
        import('./scene/screen'),
      ]);
      return createDirectory({
        indexOf: screenIndexOf,
        setState: st.setState,
        state: st.state,
        onChange: st.onChange,
        isActive: () => root.classList.contains('scene-on') && st.state.cam >= 1.9,
      });
    },
  });
}

/** ?state / ?still: fester Zustand, keine Choreografie (contracts/dom.md). */
async function startFixed(container: HTMLElement): Promise<void> {
  root.classList.remove('intro');
  try {
    const { startScene, setState } = await import('./scene');
    const patch: Record<string, unknown> = {};
    if (params.has('still')) Object.assign(patch, { lid: 1, explode: 1, cam: 1 });
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
    if (!params.has('still')) st.trackCompact();
    root.classList.add('scene-on');
    const scene = startScene(container);
    if (showLabels) scene.labels?.show('all');
    void scene.rig.ready.then(() => requestAnimationFrame(() => root.classList.add('scene-ready')));
  } catch (err) {
    console.warn('Szene nicht verfügbar:', err);
    root.classList.remove('scene-on');
    root.classList.add('no-webgl');
  }
}

void initScene();
