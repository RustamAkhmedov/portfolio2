// @vitest-environment jsdom
// T081: Kamera-Keyframe `demo` und Projektion des iframes auf das Display.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PerspectiveCamera, Vector3 } from 'three';
import { DEMO, blendPose, cameraAt, demoPose, demoRect, type CamPose } from '../src/scene/camera-path';
import { applyMatrix, createDemoFrame, isRect, quadMatrix, type Pt } from '../src/scene/demo-frame';
import { applyState, type ApplyPart } from '../src/scene/apply';
import { buildLaptop } from '../src/scene/laptop';
import { createMaterials } from '../src/scene/materials';

const root = resolve(__dirname, '..');
const parts = JSON.parse(readFileSync(join(root, 'src/content/parts.json'), 'utf8')) as ApplyPart[];
const MARGIN = { top: 72, side: 48, bottom: 32 };

describe('quadMatrix (Homographie Rechteck → Viereck)', () => {
  const quads: [Pt, Pt, Pt, Pt][] = [
    // Rechteck (affin)
    [{ x: 10, y: 20 }, { x: 410, y: 20 }, { x: 410, y: 245 }, { x: 10, y: 245 }],
    // Trapez (perspektivisch)
    [{ x: 100, y: 50 }, { x: 900, y: 80 }, { x: 860, y: 520 }, { x: 140, y: 560 }],
    // schief, unregelmäßig
    [{ x: 300, y: 10 }, { x: 1200, y: 140 }, { x: 1000, y: 700 }, { x: 80, y: 600 }],
  ];
  it.each(quads.map((q, i) => [i, q] as const))('bildet die vier Ecken genau ab (%i)', (_, q) => {
    const w = 1280;
    const h = 720;
    const m = quadMatrix(w, h, q)!;
    expect(m).toHaveLength(16);
    const got = [applyMatrix(m, 0, 0), applyMatrix(m, w, 0), applyMatrix(m, w, h), applyMatrix(m, 0, h)];
    got.forEach((p, i) => {
      expect(p.x).toBeCloseTo(q[i]!.x, 6);
      expect(p.y).toBeCloseTo(q[i]!.y, 6);
    });
  });
  it('entartete Vierecke und Größen liefern null', () => {
    const p = { x: 5, y: 5 };
    expect(quadMatrix(100, 100, [p, p, p, p])).toBeNull();
    expect(quadMatrix(0, 100, [p, p, p, p])).toBeNull();
  });
  it('isRect erkennt das Zielrechteck mit Toleranz', () => {
    const r = { x: 10, y: 20, w: 400, h: 225 };
    expect(isRect(quads[0]!, r)).toBe(true);
    expect(isRect(quads[1]!, r)).toBe(false);
  });
});

describe('Keyframe demo', () => {
  it('demoRect: Seitenverhältnis des Displays, innerhalb der Ränder, mittig, ganze Pixel', () => {
    for (const [vw, vh] of [
      [1440, 900],
      [1280, 800],
      [1920, 1080],
      [900, 1200],
    ] as const) {
      const r = demoRect(vw, vh, MARGIN);
      expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w) && Number.isInteger(r.h)).toBe(true);
      expect(Math.abs(r.w / r.h - DEMO.aspect)).toBeLessThan(0.01);
      expect(r.x).toBeGreaterThanOrEqual(MARGIN.side - 1);
      expect(r.x + r.w).toBeLessThanOrEqual(vw - MARGIN.side + 1);
      expect(r.y).toBeGreaterThanOrEqual(MARGIN.top);
      expect(r.y + r.h).toBeLessThanOrEqual(vh - MARGIN.bottom + 1);
      expect(Math.abs(r.x + r.w / 2 - vw / 2)).toBeLessThanOrEqual(1);
    }
  });

  it('blendPose: Endpunkte exakt, Mitte dazwischen, NaN = Ausgang', () => {
    const a = cameraAt(2);
    const b: CamPose = { position: [0, 4, 1], target: [0, 2.7, -3.5], fov: 30, shift: [0, 0.02] };
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    expect(blendPose(a, b, NaN)).toEqual(a);
    const m = blendPose(a, b, 0.5);
    expect(m.fov).toBeCloseTo((a.fov + b.fov) / 2, 9);
    expect(m.position[1]).toBeCloseTo((a.position[1] + b.position[1]) / 2, 9);
  });

  it('demoRect: winzige und schmale Fenster liefern endliche, positive Maße (Ränder größer als das Fenster)', () => {
    for (const [vw, vh] of [
      [60, 60],
      [100, 40],
      [320, 568],
      [2560, 400],
    ] as const) {
      const r = demoRect(vw, vh, MARGIN);
      expect([r.x, r.y, r.w, r.h].every(Number.isFinite)).toBe(true);
      expect(r.w).toBeGreaterThanOrEqual(16);
      expect(r.h).toBeGreaterThan(0);
    }
    // Hochformat: Breite begrenzt, Höhe folgt dem Seitenverhältnis
    const p = demoRect(600, 1200, MARGIN);
    expect(p.w).toBe(600 - 2 * MARGIN.side);
  });

  it('blendPose: t außerhalb 0…1 und ±Infinity werden geklemmt', () => {
    const a = cameraAt(2);
    const b: CamPose = { position: [0, 4, 1], target: [0, 2.7, -3.5], fov: 30, shift: [0, 0.02] };
    expect(blendPose(a, b, -3)).toEqual(a);
    expect(blendPose(a, b, 7)).toEqual(b);
    expect(blendPose(a, b, Infinity)).toEqual(a);
    expect(blendPose(a, b, -Infinity)).toEqual(a);
  });

  it('demoPose: Blick auf die Display-Mitte, Verschiebung 0 bei mittigem Rechteck, Abstand wächst mit kleinerem Rechteck', () => {
    const d = { center: [0, 2, -1] as [number, number, number], normal: [0, 0, 1] as [number, number, number], height: 3 };
    const big = demoPose(d, { x: 100, y: 100, w: 800, h: 600 }, 1000, 800);
    expect(big.target).toEqual([0, 2, -1]);
    expect(big.shift[0]).toBeCloseTo(0, 9);
    expect(big.shift[1]).toBeCloseTo((100 + 300 - 400) / 800, 9);
    const small = demoPose(d, { x: 100, y: 100, w: 400, h: 300 }, 1000, 800);
    expect(small.position[2]).toBeGreaterThan(big.position[2]);
    expect(big.fov).toBe(DEMO.fov);
  });

  // Ganze Kette wie in der Szene: Laptop im Projekte-Zustand, Pose `demo`, Kamera wie renderer (frame = 1, ganzer
  // Canvas), Ecken projiziert → genau das Zielrechteck (dann steht das iframe scharf per translate).
  it.each([
    [1440, 900],
    [1280, 800],
  ])('Display füllt bei %ix%i genau demoRect', (vw, vh) => {
    const laptop = buildLaptop(parts, createMaterials());
    applyState(laptop, parts, { lid: 1, explode: 1 });
    laptop.root.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(44, vw / vh, 0.1, 100);
    const viewport = { left: 0, top: 0, width: vw, height: vh };
    const frame = createDemoFrame({ camera, screen: laptop.screenMesh, viewport: () => viewport });
    const d = frame.displayFrame();
    // Normale zeigt nach vorne und leicht nach oben (Deckel 110° offen)
    expect(d.normal[2]).toBeGreaterThan(0.8);
    expect(d.normal[1]).toBeGreaterThan(0.2);
    const r = frame.rect();
    expect(r).toEqual(demoRect(vw, vh, MARGIN));
    const pose = demoPose(d, r, vw, vh);
    camera.fov = pose.fov;
    camera.position.set(...pose.position);
    camera.setViewOffset(vw, vh, -pose.shift[0] * vw, -pose.shift[1] * vh, vw, vh);
    camera.updateProjectionMatrix();
    camera.lookAt(new Vector3(...pose.target));
    camera.updateMatrixWorld();

    const el = document.createElement('iframe');
    frame.attach(el);
    expect(el.style.width).toBe(`${r.w}px`);
    expect(el.style.height).toBe(`${r.h}px`);
    expect(el.style.visibility).toBe('');
    expect(el.style.transform).toBe(`translate(${r.x}px, ${r.y}px)`);

    // Während der Fahrt (halbe Mischung): perspektivisch verzerrt, die matrix3d trifft die projizierten Ecken
    const half = blendPose(cameraAt(2), pose, 0.5);
    camera.fov = half.fov;
    camera.position.set(...half.position);
    camera.setViewOffset(vw, vh, -half.shift[0] * vw, -half.shift[1] * vh, vw, vh);
    camera.updateProjectionMatrix();
    camera.lookAt(new Vector3(...half.target));
    camera.updateMatrixWorld();
    frame.update();
    expect(el.style.transform.startsWith('matrix3d(')).toBe(true);
    frame.attach(null);
  });
});
