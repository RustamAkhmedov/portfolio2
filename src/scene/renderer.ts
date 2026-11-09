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
  /** Bildverschiebung als Anteil von Breite/Höhe (+x = nach rechts, +y = nach unten), per setViewOffset */
  shift?: readonly [number, number];
  /**
   * Bezugsrahmen der Pose (T081): 0 = der Container `#scene` (Standard, alle Scroll-Keyframes), 1 = die ganze
   * Zeichenfläche. Nur verschieden, wenn der Canvas per CSS über den Container hinaus reicht (html.demo-zoom:
   * volle Fensterbreite). Dazwischen wird der Rahmen gemischt, so bleibt das Bild beim Umschalten stehen.
   */
  frame?: number;
}

/** Zeichenfläche (Canvas) in Fenster-Koordinaten (CSS-Pixel) */
export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
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
  /** Gleitender Mittelwert der tatsächlich gezeichneten Frames (ohne Ruhepausen, siehe drawnFps); 0, wenn zuletzt nichts gezeichnet wurde. */
  fps(): number;
  /** Wird nach jedem gezeichneten Frame aufgerufen (z. B. für das Label-Overlay). */
  onFrame(fn: () => void): () => void;
  /** Wird bei Größenänderung von Container oder Canvas vor dem Neuzeichnen aufgerufen (z. B. Pose neu rechnen). */
  onResize(fn: () => void): () => void;
  /** Lage der Zeichenfläche im Fenster (CSS-Pixel), Stand der letzten Größenänderung. */
  viewport(): Viewport;
  /** Erfüllt, sobald das erste Bild gezeichnet ist (auch im Produktions-Build). */
  ready: Promise<void>;
}

declare global {
  interface Window {
    __v2?: {
      ready: Promise<void>;
      state: Readonly<SceneState>;
      fps(): number;
      /** Scroll-Marken der Choreografie in px (nur Dev/Test, gesetzt von main.ts) */
      marks?: () => Record<string, number> | null;
    };
  }
}

/** Hero-Standardpose, bis camera-path sie übernimmt. */
export const HERO_POSE: CameraPose = { position: [0, 2.2, 7.5], target: [0, 0.2, 0], fov: 32 };

const FPS_WINDOW = 30;
const FPS_STALE_MS = 500;
/** Abstand zweier gezeichneter Frames, ab dem die Szene als ruhend gilt (Pause zählt nicht als langsamer Frame). */
const FPS_PAUSE_MS = 100;

/**
 * Bildrate aus den Zeitpunkten der zuletzt gezeichneten Frames (T034). Gerendert wird nur bei Änderung,
 * beim Durchscrollen ruht die Szene also streckenweise (z. B. zwischen zwei Projekten). Solche Pausen
 * (> FPS_PAUSE_MS) gehören nicht zur Bildrate: gemittelt werden nur die Abstände innerhalb der Bewegung.
 * 0, wenn zu wenige Frames da sind oder der letzte länger als FPS_STALE_MS zurückliegt.
 */
export function drawnFps(times: readonly number[], now: number): number {
  const n = times.length;
  if (n < 2 || now - times[n - 1]! > FPS_STALE_MS) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 1; i < n; i++) {
    const gap = times[i]! - times[i - 1]!;
    if (gap > 0 && gap <= FPS_PAUSE_MS) {
      sum += gap;
      count++;
    }
  }
  return sum > 0 ? (count * 1000) / sum : 0;
}

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
  /** w, h: Canvas (CSS-Pixel); inset, base: linker Rand und Breite des Containers relativ zum Canvas */
  let size = { w: 0, h: 0, inset: 0, base: 0 };
  let view: Viewport = { left: 0, top: 0, width: 0, height: 0 };
  let shift: readonly [number, number] = [0, 0];
  let frameMix = 0;
  /**
   * Rahmung: Perspektive (aspect) und Bildverschiebung beziehen sich auf den Bezugsrahmen (Container bzw. Canvas,
   * gemischt mit frameMix); gezeichnet wird der ganze Canvas. Ohne Überstand (Normalfall) ist der Rahmen der Canvas.
   */
  function applyShift(): void {
    const { w, h, inset, base } = size;
    if (!w || !h) return;
    const fw = base + (w - base) * frameMix;
    const fl = inset * (1 - frameMix);
    camera.aspect = fw / h;
    if (shift[0] === 0 && shift[1] === 0 && fl === 0 && fw === w) camera.clearViewOffset();
    else camera.setViewOffset(fw, h, -fl - shift[0] * fw, -shift[1] * h, w, h);
  }
  function applyCamera(pose: CameraPose): void {
    camera.position.set(...pose.position);
    lookTarget.set(...pose.target);
    let projection = false;
    if (pose.fov !== undefined && pose.fov !== camera.fov) {
      camera.fov = pose.fov;
      projection = true;
    }
    const s = pose.shift ?? [0, 0];
    const f = Math.min(1, Math.max(0, pose.frame ?? 0));
    if (s[0] !== shift[0] || s[1] !== shift[1] || f !== frameMix) {
      shift = [s[0], s[1]];
      frameMix = f;
      applyShift();
      projection = true;
    }
    if (projection) camera.updateProjectionMatrix();
    camera.lookAt(lookTarget);
    requestRender();
  }
  applyCamera(HERO_POSE);

  // Frame-Zeiten nur für tatsächlich gezeichnete Frames.
  const times: number[] = [];
  const frameListeners = new Set<() => void>();
  const resizeListeners = new Set<() => void>();

  /**
   * Der Canvas folgt normalerweise dem Container (100 %); während der Live-Demo reicht er per CSS über das ganze
   * Fenster (T081). Gemessen wird beides: der Canvas bestimmt die Zeichenfläche, der Container den Bezugsrahmen.
   */
  function resize(): void {
    const c = canvas.getBoundingClientRect();
    const r = container.getBoundingClientRect();
    const w = Math.round(c.width) || container.clientWidth;
    const h = Math.round(c.height) || container.clientHeight;
    if (w === 0 || h === 0) return;
    const sizeChanged = w !== size.w || h !== size.h;
    size = { w, h, inset: Math.max(0, Math.round(r.left - c.left)), base: Math.min(w, Math.round(r.width) || w) };
    view = { left: c.left, top: c.top, width: w, height: h };
    if (sizeChanged) {
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(w, h, false);
    }
    applyShift();
    camera.updateProjectionMatrix();
    resizeListeners.forEach((fn) => fn());
    requestRender();
    // setSize leert den Canvas; ohne sofortiges Zeichnen bliebe er bis zum nächsten Frame leer (Flackern beim
    // Umschalten auf die volle Breite). ResizeObserver läuft nach rAF und vor dem Malen desselben Frames.
    if (sizeChanged && running()) draw(performance.now());
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resizeObserver.observe(canvas);
  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));
  let rendered = false;

  let wanted = false;
  let inView = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let disposed = false;

  function draw(now: number): void {
    if (!consumeNeedsRender()) return;
    renderer.render(scene, camera);
    times.push(now);
    if (times.length > FPS_WINDOW) times.shift();
    frameListeners.forEach((fn) => fn());
    if (!rendered) {
      rendered = true;
      readyResolve();
    }
  }

  function frame(now: number): void {
    raf = 0;
    if (!running()) return;
    draw(now);
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

  resize();

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

  const fps = (): number => drawnFps(times, performance.now());

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
    ready,
    onFrame(fn) {
      frameListeners.add(fn);
      return () => frameListeners.delete(fn);
    },
    onResize(fn) {
      resizeListeners.add(fn);
      return () => resizeListeners.delete(fn);
    },
    viewport: () => view,
    dispose() {
      disposed = true;
      sync();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      frameListeners.clear();
      resizeListeners.clear();
      renderer.dispose();
      canvas.remove();
    },
  };
}
