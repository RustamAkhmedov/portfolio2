// T021: Kamerapfad. Ziel-API (wird in T027 als src/scene/camera-path.ts umgesetzt):
//   export type CamKey = { name: string; position: [number, number, number]; target: [number, number, number]; fov: number };
//   export const KEYFRAMES: CamKey[];   // 8 Stück: hero, total, projekte, skills, ueber, lebenslauf, kontakt, outro
//   export function cameraAt(index: number): { position: [number, number, number]; target: [number, number, number]; fov: number };
// index ist stetig (SceneState.cam); ganzzahlig = genau ein Keyframe, dazwischen interpoliert.
// Außerhalb [0, letzter] wird geklemmt, NaN darf nie zu NaN im Ergebnis führen.
import { describe, it, expect } from 'vitest';
import { KEYFRAMES, cameraAt } from '../src/scene/camera-path';

const NAMES = ['hero', 'total', 'projekte', 'skills', 'ueber', 'lebenslauf', 'kontakt', 'outro'];
const flat = (c: { position: number[]; target: number[]; fov: number }) => [...c.position, ...c.target, c.fov];
const last = KEYFRAMES.length - 1;

describe('Kamerapfad', () => {
  it('hat 8 Keyframes mit den erwarteten Namen', () => {
    expect(KEYFRAMES).toHaveLength(8);
    expect(KEYFRAMES.map((k) => k.name)).toEqual(NAMES);
  });

  it('Keyframes sind vollständig und endlich', () => {
    for (const k of KEYFRAMES) {
      expect(k.position).toHaveLength(3);
      expect(k.target).toHaveLength(3);
      expect(flat(k).every(Number.isFinite)).toBe(true);
      expect(k.fov).toBeGreaterThan(0);
    }
  });

  it('outro entspricht wieder der Hero-Ansicht', () => {
    expect(flat(KEYFRAMES[7])).toEqual(flat(KEYFRAMES[0]));
  });

  it('cameraAt(i) bei ganzzahligem i entspricht KEYFRAMES[i]', () => {
    KEYFRAMES.forEach((k, i) => {
      const c = cameraAt(i);
      flat(c).forEach((v, j) => expect(v).toBeCloseTo(flat(k)[j], 6));
    });
  });

  it('Zwischenwerte liegen komponentenweise zwischen den Nachbarn', () => {
    for (let i = 0; i < last; i++) {
      const a = flat(KEYFRAMES[i]);
      const b = flat(KEYFRAMES[i + 1]);
      for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        flat(cameraAt(i + t)).forEach((v, j) => {
          expect(v).toBeGreaterThanOrEqual(Math.min(a[j], b[j]) - 1e-9);
          expect(v).toBeLessThanOrEqual(Math.max(a[j], b[j]) + 1e-9);
        });
      }
    }
  });

  it('ist stetig, auch über Keyframe-Grenzen', () => {
    // Schrittweite so klein, dass die Änderung durch die Gesamtspanne beschränkt bleibt.
    let maxSpan = 0;
    for (let i = 0; i < last; i++) {
      const a = flat(KEYFRAMES[i]);
      const b = flat(KEYFRAMES[i + 1]);
      a.forEach((v, j) => (maxSpan = Math.max(maxSpan, Math.abs(v - b[j]))));
    }
    const step = 0.001;
    const bound = Math.max(maxSpan * step * 10, 1e-6); // großzügig: Easing darf steiler als linear sein
    let prev = flat(cameraAt(0));
    for (let x = step; x <= last + 1e-9; x += step) {
      const cur = flat(cameraAt(x));
      cur.forEach((v, j) => expect(Math.abs(v - prev[j])).toBeLessThanOrEqual(bound));
      prev = cur;
    }
    // explizit an den Grenzen
    for (let i = 1; i < last; i++) {
      const lo = flat(cameraAt(i - 1e-6));
      const hi = flat(cameraAt(i + 1e-6));
      const mid = flat(cameraAt(i));
      mid.forEach((v, j) => {
        expect(Math.abs(v - lo[j])).toBeLessThan(1e-3);
        expect(Math.abs(v - hi[j])).toBeLessThan(1e-3);
      });
    }
  });

  it('klemmt den Index an den Rändern', () => {
    expect(flat(cameraAt(-1))).toEqual(flat(cameraAt(0)));
    expect(flat(cameraAt(-1e9))).toEqual(flat(KEYFRAMES[0]));
    expect(flat(cameraAt(last + 1))).toEqual(flat(cameraAt(last)));
    expect(flat(cameraAt(1e9))).toEqual(flat(KEYFRAMES[last]));
    expect(flat(cameraAt(Infinity))).toEqual(flat(KEYFRAMES[last]));
    expect(flat(cameraAt(-Infinity))).toEqual(flat(KEYFRAMES[0]));
  });

  it('NaN führt nicht zu einem NaN-Ergebnis', () => {
    expect(flat(cameraAt(NaN)).every(Number.isFinite)).toBe(true);
  });
});

describe('Kamerapfad kompakt (Handy-Bühne)', () => {
  it('compact = 0 ändert nichts, compact = 1 ohne Bildverschiebung nach rechts und stetig', () => {
    for (const x of [0, 0.5, 1, 1.5, 2]) expect(cameraAt(x, 0)).toEqual(cameraAt(x));
    for (let x = 0; x <= 2; x += 0.05) {
      const c = cameraAt(x, 1);
      expect(c.shift[0]).toBe(0);
      expect([...c.position, ...c.target, c.fov, ...c.shift].every(Number.isFinite)).toBe(true);
    }
  });
});
