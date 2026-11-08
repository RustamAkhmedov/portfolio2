/*
 * Partitur der Scroll-Choreografie (reine Daten und Funktionen, ohne GSAP und ohne DOM).
 *
 * Eingabe sind Scroll-Marken in Pixeln (gemessen von ScrollTrigger nach jedem refresh), Ausgabe ist eine
 * Liste von Segmenten „Wert key läuft von from nach to, während die Scroll-Position von start bis end läuft“.
 * timeline.ts baut daraus die GSAP-Master-Timeline (1 Sekunde Timeline-Zeit = 1 px Scroll), `valueAt()` ist
 * die Referenz-Auswertung für Tests.
 *
 * Schlüssel: lid, explode, cam, focusMix, screen, focus (Index in partKeys, -1 = keiner),
 * `in:<key>` (Label-Einblendung je Teil), `row:<i>` (Zeile i der Stückliste), `step:<i>` (Projekt-Datenblatt i).
 * Alle Segmente sind linear (die Glättung macht der Scrub). Segmente desselben Schlüssels überlappen nie:
 * Ein später angelegtes Segment beginnt frühestens am Ende des vorigen, sein Startwert ist dessen Endwert.
 *
 * Erweiterung für Phase 9 (T050 ff.): weitere Abschnitte als eigene Blöcke in buildScore() anhängen
 * (Marken + Label je Abschnitt, cam auf den Keyframe-Index des Abschnitts, focus auf das Teil).
 */

/** Strecken in Viewport-Höhen bzw. Anteilen. T041 übergibt kürzere Werte fürs Handy. */
export interface Lengths {
  /** Hero-Pin (Deckel klappt auf), in Viewport-Höhen */
  lid: number;
  /** Strecke je Projekt-Schritt, in Viewport-Höhen */
  step: number;
  /** Wechsel zwischen zwei Datenblättern (erste Hälfte aus, zweite ein), Anteil der Schritt-Strecke */
  swap: number;
  /** Labels beginnen bei diesem Anteil der Explosionsstrecke … */
  labelsFrom: number;
  /** … und sind so viele Viewport-Höhen nach dem Ende der Explosion alle da */
  labelsTail: number;
  /** Einblendstrecke je Label, Anteil des Label-Fensters */
  labelSpan: number;
  /** Einblendstrecke je Stücklistenzeile, Anteil des Zeilen-Fensters */
  rowSpan: number;
  /** Sprünge größer als so viele Viewport-Höhen werden ohne Glättung übernommen */
  snap: number;
}

export const DESKTOP: Lengths = {
  lid: 0.8,
  step: 0.5,
  swap: 0.2,
  labelsFrom: 0.5,
  labelsTail: 0.15,
  labelSpan: 0.35,
  rowSpan: 0.3,
  snap: 1.5,
};

/** Scroll-Positionen in px (window.scrollY), gemessen inkl. Pin-Abständen. */
export interface Marks {
  /** Viewport-Höhe in px */
  vh: number;
  /** Ende des Hero-Pins = Deckel offen, Explosion beginnt */
  lidEnd: number;
  /** Explosion fertig (Stückliste ist nachgerückt) */
  explodeEnd: number;
  /** Stücklisten-Zeilen: erste beginnt, letzte fertig */
  rowsStart: number;
  rowsEnd: number;
  /** Projekte rücken herein: Kamera fährt zum Display */
  projStart: number;
  /** = Pin-Beginn von #projekte */
  projEnd: number;
  /** Pin-Ende von #projekte (danach scrollt #projekte-alle normal) */
  stepsEnd: number;
}

export interface ScoreInput {
  marks: Marks;
  /** Teil-keys in Explosionsreihenfolge (explode.order) → Reihenfolge der Labels */
  labelOrder: readonly string[];
  /** Teil-keys in Stücklisten-Reihenfolge; `focus` ist ein Index hierin */
  partKeys: readonly string[];
  /** Anzahl Stücklisten-Zeilen */
  rows: number;
  /** Anzahl Projekt-Schritte ([data-step]) */
  steps: number;
  lengths?: Lengths;
}

export interface Segment {
  key: string;
  from: number;
  to: number;
  start: number;
  end: number;
}

export interface Score {
  initial: Record<string, number>;
  /** nach start sortiert */
  segments: Segment[];
  /** Abschnitts-Label → Scroll-Position (px); werden auch als Labels in die Master-Timeline gesetzt */
  labels: Record<string, number>;
  /** letzte Scroll-Position mit Bewegung */
  end: number;
}

/** Mindestlänge eines Segments in px (vermeidet Nulldauer-Tweens). */
const MIN = 1;

class Builder {
  readonly initial: Record<string, number> = {};
  readonly segments: Segment[] = [];
  private readonly last: Record<string, { to: number; end: number }> = {};

  init(key: string, value: number): void {
    this.initial[key] = value;
    this.last[key] = { to: value, end: -Infinity };
  }

  to(key: string, value: number, start: number, end: number): void {
    const prev = this.last[key];
    if (!prev) throw new Error(`score: Schlüssel ${key} ohne init`);
    const s = Math.max(start, prev.end);
    const e = Math.max(end, s + MIN);
    this.segments.push({ key, from: prev.to, to: value, start: s, end: e });
    this.last[key] = { to: value, end: e };
  }
}

export const inKey = (part: string): string => `in:${part}`;
export const rowKey = (i: number): string => `row:${i}`;
export const stepKey = (i: number): string => `step:${i}`;

export function buildScore(input: ScoreInput): Score {
  const { marks: m, labelOrder, partKeys, rows, steps } = input;
  const L = input.lengths ?? DESKTOP;
  const b = new Builder();

  for (const k of ['lid', 'explode', 'cam', 'focusMix', 'screen']) b.init(k, 0);
  b.init('focus', -1);
  for (const k of partKeys) b.init(inKey(k), 0);
  for (let i = 0; i < rows; i++) b.init(rowKey(i), 0);
  for (let i = 0; i < steps; i++) b.init(stepKey(i), i === 0 ? 1 : 0);

  // Hero (gepinnt): Deckel klappt auf
  b.to('lid', 1, 0, m.lidEnd);

  // Explosion, Kamera hero → total
  b.to('explode', 1, m.lidEnd, m.explodeEnd);
  b.to('cam', 1, m.lidEnd, m.explodeEnd);

  // Labels gestaffelt in Explosionsreihenfolge; die Linie zeichnet sich über setIn
  const la = m.lidEnd + L.labelsFrom * (m.explodeEnd - m.lidEnd);
  const lb = Math.max(la + MIN, m.explodeEnd + L.labelsTail * m.vh);
  const lspan = L.labelSpan * (lb - la);
  labelOrder.forEach((k, i) => {
    const s = la + (labelOrder.length > 1 ? (i * (lb - la - lspan)) / (labelOrder.length - 1) : 0);
    b.to(inKey(k), 1, s, s + lspan);
  });

  // Stückliste füllt sich Zeile für Zeile
  const rspan = L.rowSpan * (m.rowsEnd - m.rowsStart);
  for (let i = 0; i < rows; i++) {
    const s = m.rowsStart + (rows > 1 ? (i * (m.rowsEnd - m.rowsStart - rspan)) / (rows - 1) : 0);
    b.to(rowKey(i), 1, s, s + rspan);
  }

  // Projekte rücken herein: Kamera zum Display, Fokus auf den Deckel, übrige Labels gehen
  const lidIdx = partKeys.indexOf('lid');
  b.to('cam', 2, m.projStart, m.projEnd);
  b.to('focus', lidIdx, m.projStart, m.projStart + MIN);
  b.to('focusMix', 1, m.projStart, m.projEnd);
  const half = m.projStart + 0.5 * (m.projEnd - m.projStart);
  for (const k of partKeys) if (k !== 'lid') b.to(inKey(k), 0, m.projStart, half);

  // #projekte gepinnt: je Schritt ein Datenblatt, screen zählt stetig hoch
  const labels: Record<string, number> = {
    hero: 0,
    explode: m.lidEnd,
    bom: m.rowsStart,
    projekte: m.projStart,
  };
  const stepLen = steps > 0 ? (m.stepsEnd - m.projEnd) / steps : 0;
  const w = L.swap * stepLen;
  for (let i = 0; i < steps; i++) {
    labels[`projekte-${i}`] = m.projEnd + i * stepLen;
    if (i === 0) continue;
    const at = m.projEnd + i * stepLen;
    // erst das alte Blatt aus, dann das neue ein (nie zwei Texte übereinander); das Display blendet durchgehend
    b.to(stepKey(i - 1), 0, at - w / 2, at);
    b.to(stepKey(i), 1, at, at + w / 2);
    b.to('screen', i, at - w / 2, at + w / 2);
  }
  labels['projekte-alle'] = m.stepsEnd;

  const segments = b.segments.slice().sort((x, y) => x.start - y.start);
  const end = Math.max(m.stepsEnd, ...segments.map((s) => s.end));
  return { initial: b.initial, segments, labels, end };
}

/** Referenz-Auswertung: Wert von `key` bei Scroll-Position y. */
export function valueAt(score: Score, key: string, y: number): number {
  let v = score.initial[key];
  if (v === undefined) return NaN;
  for (const s of score.segments) {
    if (s.key !== key) continue;
    if (y <= s.start) break;
    if (y >= s.end) {
      v = s.to;
      continue;
    }
    return s.from + ((s.to - s.from) * (y - s.start)) / (s.end - s.start);
  }
  return v;
}

/** Alle Werte bei y (für Tests und Debug). */
export function valuesAt(score: Score, y: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(score.initial)) out[k] = valueAt(score, k, y);
  return out;
}
