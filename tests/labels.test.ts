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

  it('spreadY: Abstand je Wert (Blockhöhe) und Schrumpfen statt Stapeln, wenn die Höhe nicht reicht', () => {
    const out = spreadY([100, 110, 120], [90, 40, 0], 20, 480);
    expect(out[1]! - out[0]!).toBeGreaterThanOrEqual(90 - 1e-9);
    expect(out[2]! - out[1]!).toBeGreaterThanOrEqual(40 - 1e-9);
    // 5 Werte × 78 passen nicht in 200 px: Abstände schrumpfen gleichmäßig, nichts liegt aufeinander
    const tight = spreadY([30, 30, 30, 30, 30], 78, 20, 220);
    for (let i = 1; i < tight.length; i++) expect(tight[i]! - tight[i - 1]!).toBeCloseTo(50, 5);
    expect(tight[0]).toBe(20);
    expect(tight[4]).toBe(220);
  });

  it('placeLabels: mit Blockhöhen stehen die Textblöcke mindestens blockGap auseinander und im Bild (1280×720 … 1920×1080)', () => {
    // acht Teile wie in der Explosion: fünf Anker oben dicht beieinander, drei weiter unten
    const ys = [0.15, 0.17, 0.19, 0.21, 0.23, 0.5, 0.68, 0.9];
    const heights = [55, 55, 38, 38, 55, 71, 55, 38]; // Name + 1–3 Zeilen Spec
    for (const [w, h] of [[807, 720], [910, 900], [1332, 1080]] as const) {
      const anchors = ys.map((y, i) => ({ x: 300 + i * 20, y: y * h }));
      const p = placeLabels(anchors, w, h, { ...LAYOUT, side: 1, heights, even: 0.6 });
      const order = p.map((_, i) => i).sort((a, b) => p[a]!.y - p[b]!.y);
      for (let k = 1; k < order.length; k++) {
        const up = order[k - 1]!;
        const top = p[order[k]!]!.y - LAYOUT.radius;
        const bottom = p[up]!.y - LAYOUT.radius + Math.max(2 * LAYOUT.radius, heights[up]!);
        expect(top - bottom).toBeGreaterThanOrEqual(LAYOUT.blockGap! - 1e-6);
      }
      const last = order[order.length - 1]!;
      expect(p[last]!.y - LAYOUT.radius + heights[last]!).toBeLessThanOrEqual(h - LAYOUT.pad + 1e-6);
      expect(Math.min(...p.map((l) => l.y))).toBeGreaterThanOrEqual(LAYOUT.pad + LAYOUT.radius - 1e-6);
      // Reihenfolge der Anker bleibt
      expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it('placeLabels: even verteilt über die ganze Höhe, even 0 bleibt nah an den Ankern', () => {
    const anchors = [{ x: 100, y: 100 }, { x: 100, y: 110 }, { x: 100, y: 120 }];
    const heights = [40, 40, 40];
    const near = placeLabels(anchors, 600, 900, { ...LAYOUT, side: 1, heights, even: 0 });
    const spread = placeLabels(anchors, 600, 900, { ...LAYOUT, side: 1, heights, even: 1 });
    expect(spread[2]!.y).toBeGreaterThan(near[2]!.y + 300);
    expect(spread[0]!.y).toBeCloseTo(LAYOUT.pad + LAYOUT.radius, 5);
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

describe('placeLabels: Abschnitts-Layouts', () => {
  const w = 922;
  const h = 900;
  it('edge: Spalten am Bildrand, einzelnes Label auf der freieren Seite', () => {
    const [p] = placeLabels([{ x: 300, y: 400 }], w, h, { ...LAYOUT, edge: true });
    expect(p!.side).toBe(1);
    expect(p!.x).toBe(w - LAYOUT.pad - LAYOUT.radius - (LAYOUT.textWidth + 8));
  });

  it('split: je Hälfte eine Spalte, Abstand, nichts außerhalb', () => {
    const anchors = [200, 260, 330, 400, 460, 520].map((x, i) => ({ x: 300 + x, y: 380 + (i % 3) * 8 }));
    const p = placeLabels(anchors, w, h, { ...LAYOUT, edge: true, split: true });
    expect(p.filter((l) => l.side === -1)).toHaveLength(3);
    expect(p.filter((l) => l.side === 1)).toHaveLength(3);
    for (const side of [-1, 1] as const) {
      const ys = p.filter((l) => l.side === side).map((l) => l.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(LAYOUT.gap - 1e-9);
    }
  });

  it('split: zwei getrennte Gruppen (links/rechts) bleiben getrennt, Spalten nah an der Gruppe', () => {
    const anchors = [
      { x: 300, y: 300 },
      { x: 310, y: 400 },
      { x: 600, y: 330 },
      { x: 610, y: 420 },
    ];
    const p = placeLabels(anchors, w, h, { ...LAYOUT, edge: true, split: true });
    expect(p.map((l) => l.side)).toEqual([-1, -1, 1, 1]);
    expect(p[0]!.x).toBeLessThan(300);
    expect(p[0]!.x).toBeGreaterThan(200);
    expect(p[2]!.x).toBeGreaterThan(610);
    expect(p[2]!.x).toBeLessThan(700);
  });
});
