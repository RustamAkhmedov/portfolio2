// T030: Partitur der Scroll-Choreografie (Scroll-Position → SceneState/Overlay-Werte) und die daraus
// gebaute GSAP-Master-Timeline. Läuft ohne Browser.
import { describe, it, expect } from 'vitest';
import { buildScore, valueAt, valuesAt, DESKTOP, MOBILE, SECTIONS, inKey, portKey, rowKey, skillKey, stepKey, type Marks, type Score, type Segment } from '../src/choreo/score';
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
  // Einfahrt 700 px, Pin 540 px (0,6 vh) je Abschnitt; Outro: 900 px
  sections: [0, 1, 2, 3].map((i) => {
    const pinStart = 5400 + 1400 * i + 700;
    return { inStart: pinStart - 700, pinStart, pinEnd: pinStart + 540 };
  }),
  outroStart: 5400 + 1400 * 4 - 100,
  outroEnd: 5400 + 1400 * 4 + 800,
};
const partKeys = ['lid', 'board', 'battery', 'ssd', 'ports', 'keyboard', 'fans', 'bottom'];
const labelOrder = ['lid', 'keyboard', 'ssd', 'battery', 'board', 'ports', 'fans', 'bottom'];
const input = { marks, partKeys, labelOrder, rows: 8, steps: 6, skills: 6, ports: 4 };
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
    expect(camSegs.map((s) => s.to).slice(0, 2)).toEqual([1, 2]);
  });

  it('Abschnitts-Labels sind aufsteigend (erweiterbar für Phase 9)', () => {
    const at = Object.values(score.labels);
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThanOrEqual(at[i - 1]!);
    expect(Object.keys(score.labels)).toEqual([
      'hero', 'explode', 'bom', 'projekte',
      'projekte-0', 'projekte-1', 'projekte-2', 'projekte-3', 'projekte-4', 'projekte-5', 'projekte-alle',
      'skills', 'ueber', 'lebenslauf', 'kontakt', 'outro',
    ]);
  });
});

describe('Abschnitte Skills … Kontakt und Outro (T050/T052)', () => {
  const sMarks = marks.sections;

  it('Kamera erreicht je Abschnitt den Keyframe 3…6 und steht am Pin-Beginn; im Pin bleibt alles stehen', () => {
    SECTIONS.forEach((sec, i) => {
      const S = sMarks[i]!;
      const v = valuesAt(score, S.pinStart);
      expect(v.cam).toBe(3 + i);
      expect(partKeys[v.focus!]).toBe(sec.part);
      expect(v.focusMix).toBe(1);
      expect(v[inKey(sec.part)]).toBe(1);
      const w = valuesAt(score, S.pinEnd);
      expect(w.cam).toBe(3 + i);
      expect(w.focusMix).toBe(1);
      expect(w.explode).toBe(1);
      expect(w.lid).toBe(1);
    });
  });

  it('Kamera ist zwischen den Keyframes stetig und monoton bis zum Outro', () => {
    let prev = 0;
    for (let y = 0; y <= marks.outroStart; y += 10) {
      const c = valueAt(score, 'cam', y);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c - prev).toBeLessThan(0.1);
      prev = c;
    }
  });

  it('Fokus wechselt erst, wenn focusMix 0 ist (kein Aufblitzen des falschen Teils)', () => {
    for (let y = marks.stepsEnd; y <= marks.outroEnd + 300; y += 3) {
      const v = valuesAt(score, y);
      const idx = Math.round(v.focus!);
      const near = (k: number) => Math.abs(v.focus! - k) < 0.999;
      if (v.focus !== Math.round(v.focus!)) expect(v.focusMix, `y=${y}`).toBe(0);
      expect(near(idx)).toBe(true);
    }
  });

  it('Labels: je Abschnitt zuerst das alte Teil aus, dann das Teil mit Chips/Kanälen ein; nie zwei Teile zugleich ganz', () => {
    const board = 'board';
    const at = (i: number) => valuesAt(score, sMarks[i]!.pinStart);
    for (let n = 0; n < 6; n++) expect(at(0)[inKey(skillKey(n))]).toBe(1);
    expect(at(0)[inKey('lid')]).toBe(0);
    expect(at(1)[inKey(board)]).toBe(0);
    for (let n = 0; n < 6; n++) expect(at(1)[inKey(skillKey(n))]).toBe(0);
    expect(at(1)[inKey('battery')]).toBe(1);
    expect(at(2)[inKey('battery')]).toBe(0);
    expect(at(2)[inKey('ssd')]).toBe(1);
    for (let n = 0; n < 4; n++) expect(at(3)[inKey(portKey(n))]).toBe(1);
    expect(at(3)[inKey('ports')]).toBe(1);
    // gestaffelt: erster Chip beginnt vor dem letzten
    const starts = [0, 5].map((n) => score.segments.find((s) => s.key === inKey(skillKey(n)))!.start);
    expect(starts[0]).toBeLessThan(starts[1]!);
  });

  it('Einzelne Strecken liegen in Seitenreihenfolge (Einfahrt nie vor dem Ende des vorigen Pins)', () => {
    SECTIONS.forEach((_, i) => {
      const camSeg = score.segments.filter((s) => s.key === 'cam' && s.to === 3 + i)[0]!;
      const prevEnd = i === 0 ? marks.stepsEnd : sMarks[i - 1]!.pinEnd;
      expect(camSeg.start).toBeGreaterThanOrEqual(prevEnd);
      expect(camSeg.end).toBeLessThanOrEqual(sMarks[i]!.pinStart + 1);
    });
  });

  it('Outro: Explosion und Deckel kehren um, Kamera = Hero-Ansicht, kein Fokus, keine Labels, Schriftfeld da', () => {
    const v = valuesAt(score, marks.outroEnd);
    expect(v.explode).toBe(0);
    expect(v.lid).toBe(0);
    expect(v.cam).toBe(7);
    expect(v.focus).toBe(-1);
    expect(v.focusMix).toBe(0);
    expect(v.outro).toBe(1);
    for (const k of Object.keys(v)) if (k.startsWith('in:')) expect(v[k], k).toBe(0);
    // vor dem Outro noch zerlegt, Schriftfeld erst am Ende
    const before = valuesAt(score, marks.outroStart - 50);
    expect(before.explode).toBe(1);
    expect(before.outro).toBe(0);
    // Deckel schließt erst, wenn die Explosion zu großen Teilen zurück ist
    let y = marks.outroStart;
    while (valueAt(score, 'lid', y) === 1) y++;
    expect(valueAt(score, 'explode', y)).toBeLessThan(0.7);
  });

  it('Outro-Zustände sind monoton (explode, lid fallen; outro steigt)', () => {
    let e = 1;
    let l = 1;
    let o = 0;
    for (let y = sMarks[3]!.pinEnd; y <= score.end; y += 5) {
      const v = valuesAt(score, y);
      expect(v.explode!).toBeLessThanOrEqual(e);
      expect(v.lid!).toBeLessThanOrEqual(l);
      expect(v.outro!).toBeGreaterThanOrEqual(o);
      e = v.explode!;
      l = v.lid!;
      o = v.outro!;
    }
  });

  it('Segmente überlappen nie; auch mit MOBILE und dicht liegenden Marken (z. B. Abschnitt ohne Pin)', () => {
    const check = (s: Score) => {
      const byKey = new Map<string, Segment[]>();
      for (const seg of s.segments) byKey.set(seg.key, [...(byKey.get(seg.key) ?? []), seg]);
      for (const list of byKey.values()) {
        for (let i = 1; i < list.length; i++) expect(list[i]!.start).toBeGreaterThanOrEqual(list[i - 1]!.end);
        for (const seg of list) expect(seg.end).toBeGreaterThan(seg.start);
      }
    };
    check(score);
    const mobile = buildScore({
      ...input,
      lengths: MOBILE,
      marks: {
        ...marks,
        sections: sMarks.map((S, i) => ({ inStart: S.inStart, pinStart: S.pinStart, pinEnd: S.pinStart + (i === 1 ? 1 : 270) })),
      },
    });
    check(mobile);
    // zu dicht: Einfahrt beginnt vor dem Ende des vorigen Pins, Outro vor dem letzten Pin
    const tight = buildScore({
      ...input,
      marks: {
        ...marks,
        sections: sMarks.map((S) => ({ inStart: S.inStart - 600, pinStart: S.pinStart - 650, pinEnd: S.pinEnd - 650 })),
        outroStart: sMarks[3]!.pinStart,
        outroEnd: sMarks[3]!.pinStart + 100,
      },
    });
    check(tight);
    for (const s of [mobile, tight]) {
      const v = valuesAt(s, s.end);
      expect(v.cam).toBe(7);
      expect(v.explode).toBe(0);
    }
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

describe('Mobile Strecken (T041)', () => {
  it('MOBILE ist durchweg kürzer als DESKTOP, Pin je Projekt 0,35 vh', () => {
    expect(MOBILE.lid).toBeLessThan(DESKTOP.lid);
    expect(MOBILE.step).toBeLessThan(DESKTOP.step);
    expect(MOBILE.step).toBe(0.35);
    expect(MOBILE.labelsTail).toBeLessThanOrEqual(DESKTOP.labelsTail);
  });

  it('Partitur mit MOBILE bleibt gültig: Segmente überlappen nie, ein Datenblatt je Schritt', () => {
    const m = { ...marks, lidEnd: 400, stepsEnd: 2700 + 6 * Math.round(MOBILE.step * vh) };
    const s = buildScore({ ...input, marks: m, lengths: MOBILE });
    const byKey = new Map<string, Segment[]>();
    for (const seg of s.segments) byKey.set(seg.key, [...(byKey.get(seg.key) ?? []), seg]);
    for (const list of byKey.values()) for (let i = 1; i < list.length; i++) expect(list[i]!.start).toBeGreaterThanOrEqual(list[i - 1]!.end);
    const len = (m.stepsEnd - m.projEnd) / 6;
    for (let i = 0; i < 6; i++) {
      const v = valuesAt(s, m.projEnd + (i + 0.5) * len);
      expect(v[stepKey(i)]).toBe(1);
      expect(v.screen).toBe(i);
    }
    for (let y = m.projEnd; y <= m.stepsEnd; y += 7) {
      const v = valuesAt(s, y);
      let sum = 0;
      for (let i = 0; i < 6; i++) sum += v[stepKey(i)]!;
      expect(sum).toBeLessThanOrEqual(1.0001);
    }
  });
});
