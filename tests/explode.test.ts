/**
 * Test für src/scene/explode.ts (wird in T026 geschrieben; bis dahin schlägt der Import fehl).
 *
 * Festgelegte Signatur:
 *
 *   export function pose(
 *     part: { dir: [number, number, number]; dist: number; order: number },
 *     state: { explode: number },
 *     orderCount?: number,
 *   ): { offset: [number, number, number] };
 *
 * - `offset` wird auf die Ausgangslage des Teils addiert (Ausgangslage = Offset 0).
 * - `dir` wird normalisiert; bei explode=1 gilt offset = normalize(dir) · dist (für jedes Teil, exakt).
 * - `state.explode` wird auf 0…1 geklemmt.
 * - Stagger: kleineres `order` startet früher; `orderCount` (Default: 8 bzw. max order + 1) bestimmt
 *   die Staffelung. Die konkrete Easing-Formel ist nicht festgelegt, nur Monotonie.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pose } from '../src/scene/explode';

type Vec = [number, number, number];
const root = resolve(__dirname, '..');
const parts = (JSON.parse(readFileSync(join(root, 'src/content/parts.json'), 'utf8')) as any[]).map(
  (p) => p.explode as { dir: Vec; dist: number; order: number },
);
const orderCount = Math.max(...parts.map((p) => p.order)) + 1;

const len = (v: Vec) => Math.hypot(v[0], v[1], v[2]);
const unit = (v: Vec): Vec => {
  const l = len(v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Anteil des Wegs (0…1) entlang dir·dist. */
const progress = (p: { dir: Vec; dist: number; order: number }, e: number) =>
  dot(pose(p, { explode: e }, orderCount).offset, unit(p.dir)) / p.dist;

const steps = Array.from({ length: 101 }, (_, i) => i / 100);
const near = (a: Vec, b: Vec) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));

describe('pose(): Grundverhalten', () => {
  const part = { dir: [0, 2, 0] as Vec, dist: 1.5, order: 2 };

  it('explode=0: Ausgangslage (Offset 0)', () => {
    near(pose(part, { explode: 0 }).offset, [0, 0, 0]);
  });

  it('explode=1: dir·dist, dir wird normalisiert', () => {
    near(pose(part, { explode: 1 }).offset, [0, 1.5, 0]);
    const diag = { dir: [3, 0, 4] as Vec, dist: 2, order: 0 };
    near(pose(diag, { explode: 1 }).offset, [1.2, 0, 1.6]);
  });

  it('Werte außerhalb 0…1 werden geklemmt', () => {
    near(pose(part, { explode: -0.5 }).offset, pose(part, { explode: 0 }).offset);
    near(pose(part, { explode: 7 }).offset, pose(part, { explode: 1 }).offset);
  });

  it('monoton: Weg wächst mit explode, bleibt auf der Richtung', () => {
    let prev = -Infinity;
    for (const e of steps) {
      const o = pose(part, { explode: e }).offset;
      const along = dot(o, unit(part.dir));
      expect(along).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(along).toBeGreaterThanOrEqual(-1e-12);
      expect(along).toBeLessThanOrEqual(part.dist + 1e-12);
      expect(len(o)).toBeCloseTo(Math.abs(along), 9); // keine Querabweichung
      prev = along;
    }
  });

  it('kleineres order startet früher, alle erreichen das Ziel', () => {
    const early = { dir: [0, 1, 0] as Vec, dist: 1, order: 0 };
    const late = { dir: [0, 1, 0] as Vec, dist: 1, order: 5 };
    const start = (p: typeof early) =>
      steps.find((e) => dot(pose(p, { explode: e }, 8).offset, [0, 1, 0]) > 1e-6)!;
    expect(start(early)).toBeLessThan(start(late));
    for (const e of [0.2, 0.4, 0.6]) {
      const a = dot(pose(early, { explode: e }, 8).offset, [0, 1, 0]);
      const b = dot(pose(late, { explode: e }, 8).offset, [0, 1, 0]);
      expect(a).toBeGreaterThanOrEqual(b);
    }
    near(pose(late, { explode: 1 }, 8).offset, [0, 1, 0]);
  });
});

describe('pose(): alle echten Teile aus parts.json', () => {
  it('es gibt Teile mit verschiedenen order-Werten', () => {
    expect(parts.length).toBeGreaterThan(1);
    expect(new Set(parts.map((p) => p.order)).size).toBe(parts.length);
  });

  parts.forEach((p, i) => {
    it(`Teil #${i} (order ${p.order}): 0 → Ausgangslage, 1 → dir·dist, monoton, geklemmt`, () => {
      near(pose(p, { explode: 0 }, orderCount).offset, [0, 0, 0]);
      const u = unit(p.dir);
      near(pose(p, { explode: 1 }, orderCount).offset, [u[0] * p.dist, u[1] * p.dist, u[2] * p.dist]);
      near(pose(p, { explode: 3 }, orderCount).offset, pose(p, { explode: 1 }, orderCount).offset);
      near(pose(p, { explode: -3 }, orderCount).offset, [0, 0, 0]);
      let prev = -Infinity;
      for (const e of steps) {
        const pr = progress(p, e);
        expect(pr).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = pr;
      }
    });
  });

  it('Stagger: höheres order ist nie weiter als kleineres, und startet später', () => {
    for (const e of steps) {
      for (let i = 1; i < parts.length; i++) {
        const a = parts.find((p) => p.order === i - 1)!;
        const b = parts.find((p) => p.order === i)!;
        expect(progress(a, e)).toBeGreaterThanOrEqual(progress(b, e) - 1e-9);
      }
    }
    const start = (p: (typeof parts)[number]) => steps.find((e) => progress(p, e) > 1e-6) ?? 2;
    const sorted = [...parts].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) expect(start(sorted[i - 1])).toBeLessThan(start(sorted[i]));
  });
});
