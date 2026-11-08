import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/sections.css';

const root = document.documentElement;
const params = new URLSearchParams(location.search);

/** Szene nur mit WebGL und ohne reduzierte Bewegung (contracts/dom.md). */
async function initScene(): Promise<void> {
  if (root.classList.contains('reduced') || root.classList.contains('no-webgl')) return;
  const container = document.getElementById('scene');
  if (!container) return;
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
    if (params.has('still')) root.classList.add('still');
    setState(patch);

    // Container braucht eine Größe vor dem Renderer.
    root.classList.add('scene-on');
    startScene(container);
    void window.__v2?.ready.then(() => requestAnimationFrame(() => root.classList.add('scene-ready')));
  } catch (err) {
    console.warn('Szene nicht verfügbar:', err);
    root.classList.remove('scene-on');
    root.classList.add('no-webgl');
  }
}

void initScene();
