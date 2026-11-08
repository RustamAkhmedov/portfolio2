/**
 * Explosionsgrad → Offset eines Teils (reine Funktion, kein three-Import).
 *
 * Jedes Teil läuft von seiner Ausgangslage (Offset 0) entlang normalize(dir) bis dir·dist.
 * Stagger: kleineres `order` startet früher; alle Teile enden gemeinsam bei explode = 1.
 */
export type Vec3 = [number, number, number];

export interface ExplodePart {
  dir: Vec3;
  dist: number;
  order: number;
}

/** Anteil des Explosionsbereichs 0…1, über den die Startzeitpunkte gestaffelt werden. */
const STAGGER_SPAN = 0.5;
const DEFAULT_ORDER_COUNT = 8;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function pose(
  part: ExplodePart,
  state: { explode: number },
  orderCount: number = DEFAULT_ORDER_COUNT,
): { offset: Vec3 } {
  const e = clamp01(Number.isFinite(state.explode) ? state.explode : 0);
  const count = Math.max(1, orderCount);
  const start = (STAGGER_SPAN * Math.max(0, part.order)) / count;
  const t = clamp01((e - start) / (1 - start));
  const k = t * t * (3 - 2 * t); // smoothstep, t=1 → exakt 1

  const [x, y, z] = part.dir;
  const l = Math.hypot(x, y, z) || 1;
  const s = (part.dist * k) / l;
  return { offset: [x * s, y * s, z * s] };
}
