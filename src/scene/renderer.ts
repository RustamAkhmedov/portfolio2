/*
 * Renderer der Explosionszeichnung (plan.md, research.md R9, contracts/dom.md).
 * Transparenter Canvas (das Papier kommt vom CSS), render on demand über state.consumeNeedsRender,
 * Pause bei unsichtbarem Canvas oder Tab. Zeichnet selbst keine Objekte.
 */
import {
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { consumeNeedsRender, requestRender, state, type SceneState } from './state';

export interface CameraPose {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** vertikaler Blickwinkel in Grad */
  fov?: number;
}

export interface SceneRig {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Setzt die Kamera und fordert ein Neuzeichnen an. */
  applyCamera(pose: CameraPose): void;
  /** Startet die Schleife (idempotent); sie läuft nur, solange Canvas und Tab sichtbar sind. */
  start(): void;
  stop(): void;
  dispose(): void;
  /** Gleitender Mittelwert der tatsächlich gezeichneten Frames; 0, wenn zuletzt nichts gezeichnet wurde. */
  fps(): number;
  /** Wird nach jedem gezeichneten Frame aufgerufen (z. B. für das Label-Overlay). */
  onFrame(fn: () => void): () => void;
}

declare global {
  interface Window {
    __v2?: { ready: Promise<void>; state: Readonly<SceneState>; fps(): number };
  }
}

/** Hero-Standardpose, bis camera-path sie übernimmt. */
export const HERO_POSE: CameraPose = { position: [0, 2.2, 7.5], target: [0, 0.2, 0], fov: 32 };

const FPS_WINDOW = 30;
const FPS_STALE_MS = 500;

function isMobile(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 767px)').matches
  );
}

function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? 2 : 1.5);
}

export function createRenderer(container: HTMLElement): SceneRig {
  const dpr = pixelRatio();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: dpr < 2,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    throw new Error(`WebGL nicht verfügbar: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!renderer.getContext()) {
    renderer.dispose();
    throw new Error('WebGL nicht verfügbar: kein Kontext');
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(HERO_POSE.fov, 1, 0.1, 100);

  // Zwei Lichter, kein Schatten: Hemisphere (weich) + Directional (Richtung), dazu kein Ambient nötig.
  const hemi = new HemisphereLight(0xffffff, 0xb9b3a3, 1.1);
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 5);
  scene.add(hemi, sun);

  const lookTarget = new Vector3();
  function applyCamera(pose: CameraPose): void {
    camera.position.set(...pose.position);
    lookTarget.set(...pose.target);
    if (pose.fov !== undefined && pose.fov !== camera.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(lookTarget);
    requestRender();
  }
  applyCamera(HERO_POSE);

  function resize(): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // Frame-Zeiten nur für tatsächlich gezeichnete Frames.
  const times: number[] = [];
  const frameListeners = new Set<() => void>();
  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));
  let rendered = false;

  let wanted = false;
  let inView = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let disposed = false;

  function frame(now: number): void {
    raf = 0;
    if (!running()) return;
    if (consumeNeedsRender()) {
      renderer.render(scene, camera);
      times.push(now);
      if (times.length > FPS_WINDOW) times.shift();
      frameListeners.forEach((fn) => fn());
      if (!rendered) {
        rendered = true;
        readyResolve();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function running(): boolean {
    return wanted && inView && tabVisible && !disposed;
  }
  function sync(): void {
    if (running()) {
      if (!raf) {
        requestRender();
        raf = requestAnimationFrame(frame);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const intersection = new IntersectionObserver((entries) => {
    const last = entries[entries.length - 1];
    if (last) inView = last.isIntersecting;
    sync();
  });
  intersection.observe(container);
  const onVisibility = (): void => {
    tabVisible = document.visibilityState !== 'hidden';
    sync();
  };
  document.addEventListener('visibilitychange', onVisibility);

  function fps(): number {
    if (times.length < 2) return 0;
    if (performance.now() - times[times.length - 1]! > FPS_STALE_MS) return 0;
    const span = times[times.length - 1]! - times[0]!;
    return span > 0 ? ((times.length - 1) * 1000) / span : 0;
  }

  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV || params.has('still') || params.has('state')) {
    window.__v2 = { ready, state, fps };
  }

  return {
    scene,
    camera,
    renderer,
    applyCamera,
    start() {
      wanted = true;
      sync();
    },
    stop() {
      wanted = false;
      sync();
    },
    fps,
    onFrame(fn) {
      frameListeners.add(fn);
      return () => frameListeners.delete(fn);
    },
    dispose() {
      disposed = true;
      sync();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      frameListeners.clear();
      renderer.dispose();
      canvas.remove();
    },
  };
}
