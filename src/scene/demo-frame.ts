/*
 * Live-Demo-Overlay (T081): legt ein DOM-Element (das `<iframe id="demo-frame">` der Choreografie) deckungsgleich
 * über die projizierte Display-Fläche. Je gezeichnetem Frame werden die vier Ecken der aktiven Fläche projiziert
 * und das Element per CSS `transform: matrix3d(…)` (Homographie Rechteck → Viereck, transform-origin 0 0) darauf
 * gelegt. Die Grundgröße des Elements ist das Zielrechteck `demoRect` der Kamera-Pose `demo`: in Ruhe (Pose
 * erreicht) ist die Abbildung eine reine Verschiebung um ganze Pixel, das iframe steht dann unskaliert und scharf.
 *
 * Die Szene kennt keine Texte und keine Scroll-Logik: Sie bekommt nur das Element (attach) und liefert die Lage
 * des Displays (displayFrame) für den Keyframe `demo`. Was im Element steht, entscheidet die Choreografie.
 */
import { Vector3, type Camera, type Mesh } from 'three';
import { demoRect, type DisplayFrame, type Rect } from './camera-path';
import type { Viewport } from './renderer';

// ---------- reine Funktionen (ohne WebGL testbar) ----------

export interface Pt {
  x: number;
  y: number;
}

/**
 * CSS-`matrix3d` (16 Werte, spaltenweise), die das Rechteck (0,0)–(w,h) eines Elements mit transform-origin 0 0 auf
 * das Viereck q abbildet; q = [oben links, oben rechts, unten rechts, unten links]. Projektive Abbildung nach
 * Heckbert (Einheitsquadrat → Viereck), danach auf w × h skaliert. null bei entartetem Viereck.
 */
export function quadMatrix(w: number, h: number, q: readonly [Pt, Pt, Pt, Pt]): number[] | null {
  if (!(w > 0) || !(h > 0)) return null;
  const [p0, p1, p2, p3] = q;
  // Fläche (Gaußsche Trapezformel): zusammengefallene Ecken → keine Abbildung
  const area = (p0.x * p1.y - p1.x * p0.y + p1.x * p2.y - p2.x * p1.y + p2.x * p3.y - p3.x * p2.y + p3.x * p0.y - p0.x * p3.y) / 2;
  if (!(Math.abs(area) > 1e-6)) return null;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let a: number, b: number, d: number, e: number, g: number, k: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = p1.x - p0.x;
    b = p3.x - p0.x;
    d = p1.y - p0.y;
    e = p3.y - p0.y;
    g = 0;
    k = 0;
  } else {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (sx * dy2 - dx2 * sy) / den;
    k = (dx1 * sy - sx * dy1) / den;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + k * p3.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + k * p3.y;
  }
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, p0.x, p0.y, 0, 1];
  return m.every(Number.isFinite) ? m : null;
}

/** Wendet eine matrix3d (spaltenweise) auf den Punkt (x, y) an (zum Prüfen). */
export function applyMatrix(m: readonly number[], x: number, y: number): Pt {
  const X = m[0]! * x + m[4]! * y + m[12]!;
  const Y = m[1]! * x + m[5]! * y + m[13]!;
  const W = m[3]! * x + m[7]! * y + m[15]!;
  return { x: X / W, y: Y / W };
}

/** Viereck ist das achsparallele Rechteck r (Toleranz in px)? Dann reicht eine Verschiebung (scharf). */
export function isRect(q: readonly [Pt, Pt, Pt, Pt], r: Rect, tol = 0.6): boolean {
  const near = (p: Pt, x: number, y: number): boolean => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol;
  return (
    near(q[0], r.x, r.y) && near(q[1], r.x + r.w, r.y) && near(q[2], r.x + r.w, r.y + r.h) && near(q[3], r.x, r.y + r.h)
  );
}

// ---------- three / DOM ----------

export interface DemoFrame {
  /** Element, das über dem Display liegen soll (null = keins). Wird sofort und dann je Frame gesetzt. */
  attach(el: HTMLElement | null): void;
  /** Ecken neu projizieren und das Element setzen (nach jedem gezeichneten Frame). */
  update(): void;
  /** Lage der aktiven Display-Fläche (Welt), für die Kamera-Pose `demo`. */
  displayFrame(): DisplayFrame;
  /** Zielrechteck der Pose `demo` für die aktuelle Zeichenfläche. */
  rect(): Rect;
}

const MARGIN_FALLBACK = { top: 72, side: 48, bottom: 32 };

function cssPx(name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * @param screen Display-Mesh (PlaneGeometry mit UV: u nach rechts, v nach oben)
 * @param viewport Lage des Canvas im Fenster (renderer.viewport)
 */
export function createDemoFrame(deps: { camera: Camera; screen: Mesh; viewport: () => Viewport }): DemoFrame {
  const { camera, screen } = deps;
  // Ecken der aktiven Fläche im Mesh: aus der Geometrie, sortiert nach UV (oben links, oben rechts, unten rechts, unten links)
  const pos = screen.geometry.getAttribute('position');
  const uv = screen.geometry.getAttribute('uv');
  const local: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  const want: [number, number][] = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0],
  ];
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    want.forEach(([wu, wv], j) => {
      if (Math.abs(u - wu) < 1e-6 && Math.abs(v - wv) < 1e-6) local[j]!.fromBufferAttribute(pos, i);
    });
  }

  const world = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  const tmp = new Vector3();
  const margin = {
    top: cssPx('--s-8', MARGIN_FALLBACK.top),
    side: cssPx('--s-7', MARGIN_FALLBACK.side),
    bottom: cssPx('--s-6', MARGIN_FALLBACK.bottom),
  };
  let el: HTMLElement | null = null;
  let lastSize = '';
  let lastTransform = '';

  function corners(): Vector3[] {
    screen.updateWorldMatrix(true, false);
    local.forEach((p, i) => world[i]!.copy(p).applyMatrix4(screen.matrixWorld));
    return world;
  }

  function rect(): Rect {
    const vp = deps.viewport();
    return demoRect(vp.width, vp.height, margin);
  }

  function displayFrame(): DisplayFrame {
    const [tl, tr, , bl] = corners() as [Vector3, Vector3, Vector3, Vector3];
    const center = tmp.copy(world[0]!).add(world[1]!).add(world[2]!).add(world[3]!).multiplyScalar(0.25);
    const right = new Vector3().subVectors(tr, tl);
    const up = new Vector3().subVectors(tl, bl);
    const normal = new Vector3().crossVectors(right, up).normalize();
    return { center: [center.x, center.y, center.z], normal: [normal.x, normal.y, normal.z], height: up.length() };
  }

  function update(): void {
    if (!el) return;
    const r = rect();
    const size = `${r.w}x${r.h}`;
    if (size !== lastSize) {
      lastSize = size;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    }
    const vp = deps.viewport();
    camera.updateMatrixWorld();
    const q: Pt[] = [];
    for (const p of corners()) {
      // vor der Kamera? (Blickrichtung −z im Kamerasystem)
      tmp.copy(p).applyMatrix4(camera.matrixWorldInverse);
      if (tmp.z > -1e-3) {
        if (lastTransform !== 'hidden') {
          el.style.visibility = 'hidden';
          lastTransform = 'hidden';
        }
        return;
      }
      tmp.copy(p).project(camera);
      q.push({ x: vp.left + ((tmp.x + 1) / 2) * vp.width, y: vp.top + ((1 - tmp.y) / 2) * vp.height });
    }
    const quad = q as [Pt, Pt, Pt, Pt];
    let transform: string;
    if (isRect(quad, r)) transform = `translate(${r.x}px, ${r.y}px)`;
    else {
      const m = quadMatrix(r.w, r.h, quad);
      transform = m ? `matrix3d(${m.map((v) => +v.toFixed(9)).join(',')})` : '';
    }
    if (!transform) {
      el.style.visibility = 'hidden';
      lastTransform = 'hidden';
      return;
    }
    if (transform !== lastTransform) {
      el.style.transform = transform;
      el.style.visibility = '';
      lastTransform = transform;
    }
  }

  return {
    attach(next) {
      el = next;
      lastSize = '';
      lastTransform = '';
      if (el) {
        el.style.visibility = 'hidden'; // bis zur ersten Projektion
        update();
      }
    },
    update,
    displayFrame,
    rect,
  };
}
