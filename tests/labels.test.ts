import { describe, expect, it } from 'vitest';
import { edgeFactor, lineEnd, ndcToPixel, placeLabels, spreadY, LAYOUT } from '../src/scene/labels';

describe('Label-Projektion und Platzierung', () => {
  it('ndcToPixel: Mitte, Ecken, y gespiegelt', () => {
    expect(ndcToPixel(0, 0, 200, 100)).toEqual({ x: 100, y: 50 });
    expect(ndcToPixel(-1, 1, 200, 100)).toEqual({ x: 0, y: 0 });
    expect(ndcToPixel(1, -1, 200, 100)).toEqual({ x: 200, y: 100 });
  });

  it('edgeFactor: im Bild 1, außerhalb 0, hinter der Kamera 0', () => {
    expect(edgeFactor({ x: 100, y: 50 }, 0.5, 200, 100)).toBe(1);
    expect(edgeFactor({ x: -5, y: 50 }, 0.5, 200, 100)).toBe(0);
    expect(edgeFactor({ x: 210, y: 50 }, 0.5, 200, 100)).toBe(0);
    expect(edgeFactor({ x: 100, y: 50 }, 1.2, 200, 100)).toBe(0);
    expect(edgeFactor({ x: 16, y: 50 }, 0.5, 200, 100)).toBeCloseTo(0.5);
  });

  it('spreadY: Abstand, Grenzen, ursprüngliche Reihenfolge der Eingabe', () => {
    const out = spreadY([100, 102, 101, 400], 50, 20, 480);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(50 - 1e-9);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...out)).toBeLessThanOrEqual(480);
    expect(out[0]).toBeLessThan(out[2]!); // 100 vor 101
    expect(out[2]).toBeLessThan(out[1]!); // 101 vor 102
    expect(out[3]).toBe(400);
  });

  it('spreadY: schiebt am unteren Rand zurück', () => {
    const out = spreadY([470, 475, 480], 50, 20, 480);
    expect(out).toEqual([380, 430, 480]);
  });

  it('placeLabels: Seite nach Bildschirmhälfte, Spalte außen, entzerrt, im Bild', () => {
    const w = 1440;
    const h = 900;
    const anchors = [
      { x: 500, y: 300 },
      { x: 520, y: 305 },
      { x: 900, y: 300 },
      { x: 950, y: 310 },
    ];
    const p = placeLabels(anchors, w, h);
    expect(p.map((l) => l.side)).toEqual([-1, -1, 1, 1]);
    expect(p[0]!.x).toBe(p[1]!.x);
    expect(p[0]!.x).toBeLessThan(500);
    expect(p[3]!.x).toBeGreaterThan(950);
    expect(Math.abs(p[0]!.y - p[1]!.y)).toBeGreaterThanOrEqual(LAYOUT.gap - 1e-9);
    expect(Math.abs(p[2]!.y - p[3]!.y)).toBeGreaterThanOrEqual(LAYOUT.gap - 1e-9);
    for (const l of p) {
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(w);
      expect(l.y).toBeGreaterThan(0);
      expect(l.y).toBeLessThan(h);
    }
  });

  it('placeLabels: Spalte lässt Platz für den Text am Bildrand', () => {
    const p = placeLabels([{ x: 30, y: 100 }, { x: 1410, y: 100 }], 1440, 900);
    expect(p[0]!.x).toBeGreaterThanOrEqual(LAYOUT.pad + LAYOUT.radius + LAYOUT.textWidth);
    expect(p[1]!.x).toBeLessThanOrEqual(1440 - LAYOUT.pad - LAYOUT.radius - LAYOUT.textWidth);
  });

  it('placeLabels: side zwingt alle Labels in eine Spalte rechts', () => {
    const anchors = [{ x: 100, y: 100 }, { x: 300, y: 300 }, { x: 600, y: 200 }];
    const p = placeLabels(anchors, 1000, 800, { ...LAYOUT, side: 1 });
    expect(p.every((l) => l.side === 1)).toBe(true);
    expect(new Set(p.map((l) => l.x)).size).toBe(1);
    expect(p[0]!.x).toBeGreaterThan(600);
  });

  it('lineEnd: liegt auf dem Kreisrand Richtung Anker', () => {
    const e = lineEnd({ x: 100, y: 0 }, { x: 0, y: 0 }, 14);
    expect(e).toEqual({ x: 14, y: 0 });
    expect(lineEnd({ x: 3, y: 4 }, { x: 0, y: 0 }, 14)).toEqual({ x: 0, y: 0 });
  });
});
