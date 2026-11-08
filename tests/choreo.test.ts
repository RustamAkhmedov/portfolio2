// T030: Partitur der Scroll-Choreografie (Scroll-Position → SceneState/Overlay-Werte) und die daraus
// gebaute GSAP-Master-Timeline. Läuft ohne Browser.
import { describe, it, expect } from 'vitest';
import { buildScore, valueAt, valuesAt, DESKTOP, inKey, rowKey, stepKey, type Marks, type Segment } from '../src/choreo/score';
import { buildMaster, type Proxy } from '../src/choreo/master';

const vh = 900;
const marks: Marks = {
  vh,
  lidEnd: 720,
  explodeEnd: 1400,
  rowsStart: 1300,
  rowsEnd: 1900,
  projStart: 2400,
  projEnd: 2700,
  stepsEnd: 2700 + 6 * 450,
};
const partKeys = ['lid', 'board', 'battery', 'ssd', 'ports', 'keyboard', 'fans', 'bottom'];
const labelOrder = ['lid', 'keyboard', 'ssd', 'battery', 'board', 'ports', 'fans', 'bottom'];
const input = { marks, partKeys, labelOrder, rows: 8, steps: 6 };
const score = buildScore(input);

describe('Partitur', () => {
  it('Startzustand: zu, nicht explodiert, Hero-Kamera, nur das erste Datenblatt sichtbar', () => {
    const v = valuesAt(score, 0);
    expect(v.lid).toBe(0);
    expect(v.explode).toBe(0);
    expect(v.cam).toBe(0);
    expect(v.focus).toBe(-1);
    expect(v[stepKey(0)]).toBe(1);
    for (let i = 1; i < 6; i++) expect(v[stepKey(i)]).toBe(0);
    for (const k of partKeys) expect(v[inKey(k)]).toBe(0);
  });

  it('Hero-Pin: Deckel öffnet sich monoton, Explosion wartet', () => {
    let prev = -1;
    for (let y = 0; y <= marks.lidEnd; y += 40) {
      const lid = valueAt(score, 'lid', y);
      expect(lid).toBeGreaterThanOrEqual(prev);
      prev = lid;
      expect(valueAt(score, 'explode', y)).toBe(0);
    }
    expect(valueAt(score, 'lid', marks.lidEnd)).toBe(1);
  });

  it('Explosion und Kamera hero → total laufen gemeinsam bis explodeEnd', () => {
    const mid = (marks.lidEnd + marks.explodeEnd) / 2;
    expect(valueAt(score, 'explode', mid)).toBeCloseTo(0.5, 6);
    expect(valueAt(score, 'cam', mid)).toBeCloseTo(0.5, 6);
    expect(valueAt(score, 'explode', marks.explodeEnd)).toBe(1);
    expect(valueAt(score, 'cam', marks.explodeEnd)).toBe(1);
  });

  it('Labels erscheinen gestaffelt in Explosionsreihenfolge, alle bis kurz nach der Explosion', () => {
    const starts = labelOrder.map((k) => score.segments.find((s) => s.key === inKey(k))!.start);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]!);
    expect(starts[0]).toBeGreaterThan(marks.lidEnd);
    const allIn = marks.explodeEnd + DESKTOP.labelsTail * vh;
    for (const k of partKeys) expect(valueAt(score, inKey(k), allIn)).toBe(1);
  });

  it('Stückliste: Zeilen nacheinander, alle sichtbar am Ende des Fensters', () => {
    const y = (marks.rowsStart + marks.rowsEnd) / 2;
    const vals = Array.from({ length: 8 }, (_, i) => valueAt(score, rowKey(i), y));
    for (let i = 1; i < 8; i++) expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]!);
    for (let i = 0; i < 8; i++) expect(valueAt(score, rowKey(i), marks.rowsEnd)).toBe(1);
  });

  it('Projekte: Kamera auf Display, Fokus lid, nur das Display-Label bleibt', () => {
    const v = valuesAt(score, marks.projEnd);
    expect(v.cam).toBe(2);
    expect(partKeys[v.focus!]).toBe('lid');
    expect(v.focusMix).toBe(1);
    expect(v[inKey('lid')]).toBe(1);
    for (const k of partKeys.filter((k) => k !== 'lid')) expect(v[inKey(k)]).toBe(0);
  });

  it('Projekt-Schritte: höchstens ein Datenblatt sichtbar, je Schritt ganz, screen zählt stetig 0…5', () => {
    const len = (marks.stepsEnd - marks.projEnd) / 6;
    let prev = 0;
    for (let y = marks.projEnd; y <= marks.stepsEnd + 200; y += 15) {
      const screen = valueAt(score, 'screen', y);
      expect(screen).toBeGreaterThanOrEqual(prev);
      expect(screen - prev).toBeLessThan(0.2); // stetig, keine Sprünge
      prev = screen;
      const ops = Array.from({ length: 6 }, (_, i) => valueAt(score, stepKey(i), y));
      expect(ops.filter((o) => o > 0).length).toBeLessThanOrEqual(1); // nie zwei Datenblätter übereinander
    }
    for (let i = 0; i < 6; i++) {
      const y = marks.projEnd + (i + 0.5) * len;
      expect(valueAt(score, 'screen', y)).toBe(i);
      expect(valueAt(score, stepKey(i), y)).toBe(1);
    }
    expect(valueAt(score, 'screen', marks.stepsEnd)).toBe(5);
  });

  it('Segmente eines Schlüssels überlappen nie, auch wenn die Marken zu dicht liegen', () => {
    const tight = buildScore({ ...input, marks: { ...marks, projStart: 1000, projEnd: 1100 } });
    const byKey = new Map<string, Segment[]>();
    for (const s of tight.segments) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
    for (const segs of byKey.values()) {
      for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBeGreaterThanOrEqual(segs[i - 1]!.end);
      for (const s of segs) expect(s.end).toBeGreaterThan(s.start);
    }
    // Kamera erreicht trotzdem erst total, dann das Display
    const camSegs = byKey.get('cam')!;
    expect(camSegs.map((s) => s.to)).toEqual([1, 2]);
  });

  it('Abschnitts-Labels sind aufsteigend (erweiterbar für Phase 9)', () => {
    const at = Object.values(score.labels);
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThanOrEqual(at[i - 1]!);
    expect(Object.keys(score.labels)).toEqual([
      'hero', 'explode', 'bom', 'projekte',
      'projekte-0', 'projekte-1', 'projekte-2', 'projekte-3', 'projekte-4', 'projekte-5', 'projekte-alle',
    ]);
  });
});

describe('Master-Timeline (GSAP)', () => {
  const proxy: Proxy = {};
  const master = buildMaster(score, proxy);
  const keys = Object.keys(score.initial);

  const check = (y: number) => {
    master.time(y);
    for (const k of keys) expect(proxy[k], `${k} @ ${y}`).toBeCloseTo(valueAt(score, k, y), 5);
  };

  it('stimmt vorwärts mit der Partitur überein', () => {
    for (let y = 0; y <= score.end + 100; y += 37) check(Math.min(y, master.duration()));
  });

  it('stimmt bei Sprüngen (Anker, Pos1/Ende) und rückwärts überein', () => {
    const seq = [score.end, 0, marks.projEnd + 700, marks.lidEnd / 2, marks.explodeEnd, 50, score.end, 1600, 0];
    for (const y of seq) check(Math.min(y, master.duration()));
    let s = 7;
    for (let i = 0; i < 200; i++) {
      s = (s * 9301 + 49297) % 233280;
      check((s / 233280) * master.duration());
    }
  });

  it('Neubau (refresh) setzt auf die neue Partitur', () => {
    const moved = buildScore({ ...input, marks: { ...marks, lidEnd: 900, explodeEnd: 1700 } });
    buildMaster(moved, proxy, master);
    master.time(1300);
    expect(proxy.explode).toBeCloseTo(valueAt(moved, 'explode', 1300), 5);
    expect(master.labels.explode).toBe(900);
  });
});
