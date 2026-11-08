// Kamerapfad: ein Keyframe pro Stopp der Choreografie, SceneState.cam ist der stetige Index.
// Reine Daten und Funktion (keine three-Imports). Einheiten: 1 = 100 mm, Laptop ~3,54 × 2,47 um den Ursprung.
// Erste Schätzung ohne Modell – Feinabstimmung in T033 per Screenshots.

export type Vec3 = [number, number, number];
/** shift: Bildverschiebung als Anteil von Breite/Höhe (+x rechts, +y unten), Standard [0, 0] */
export type CamKey = {
  name: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  shift?: [number, number];
  /** Abweichungen für die kompakte Bühne (Handy/Tablet < 900 px: Szene oben, ohne Label-Spalte, Seitenverhältnis ~1–1,6) */
  compact?: Partial<Omit<CamKey, 'name' | 'compact'>>;
};
export type CamPose = { position: Vec3; target: Vec3; fov: number; shift: [number, number] };

/** Hero: 3/4 von vorne rechts, leicht von oben (entspricht grob HERO_POSE im Renderer, seitlich gedreht). */
// Mit 3D-Szene steht #scene rechts neben der Textspalte (layout.css, --scene-left); fov/shift sind darauf abgestimmt.
const HERO: CamKey = { name: 'outro', position: [4.6, 2.8, 6.6], target: [0, 0.6, 0], fov: 37, shift: [0, 0.075] };

export const KEYFRAMES: CamKey[] = [
  { ...HERO, name: 'hero' },
  // Totale: alle Teile der vollen Explosion im Bild (y ~ -1 bis 2,5+, x ~ -3,5 bis 2, Deckel hinten bei z ~ -2)
  // shift nach links: rechts daneben steht die Label-Spalte
  { name: 'total', position: [3.0, 6.2, 8.2], target: [-0.3, 1.3, -0.8], fov: 46, shift: [-0.17, 0.02], compact: { fov: 44 } },
  // Display/Deckel (explodiert: Mitte ~ (0, 2.75, -3.5), Normale 20° nach oben): fast frontal und so hoch,
  // dass die angehobene Tastatur die Unterkante des Displays nicht verdeckt
  { name: 'projekte', position: [1.0, 5.8, 2.4], target: [0.1, 2.6, -3.5], fov: 44, shift: [0.06, 0.0], compact: { position: [0, 4.6, 1.6], target: [0, 2.75, -3.5], fov: 40, shift: [0, 0] } },
  // Mainboard: hinten mittig, steiler Blick von vorne rechts oben, damit die Chips frei liegen; Platz für die Label-Spalte rechts
  { name: 'skills', position: [3.0, 9.66, 8.04], target: [0, 0.9, -0.6], fov: 40, shift: [0, 0.0], compact: { fov: 44, shift: [0, 0] } },
  // Akku: vorne, etwas höher gehoben
  { name: 'ueber', position: [-1.8, 4.6, 6.6], target: [0, 1.6, 0.4], fov: 47, shift: [-0.04, 0.0], compact: { fov: 42, shift: [0, 0] } },
  // SSD (Lasche vorne rechts, 2 Einheiten angehoben): groß im Bild
  { name: 'lebenslauf', position: [2.8, 4.4, 4.2], target: [1.1, 2.0, 0.2], fov: 33, shift: [-0.1, 0.0], compact: { shift: [0, 0] } },
  // Anschlüsse: links (-x) weggezogen, beide Seiten (USB-A rechts) im Bild
  { name: 'kontakt', position: [-3.97, 3.44, 9.18], target: [-1.0, 0.2, 0], fov: 44, shift: [0, 0.1], compact: { fov: 48, shift: [0, 0] } },
  { ...HERO, name: 'outro' },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Schlüssel für die kompakte Bühne: Überschreibungen anwenden, Bildverschiebung nach rechts entfällt (keine Label-Spalte). */
function resolve(k: CamKey, compact: boolean): CamKey {
  if (!compact) return k;
  return { ...k, ...k.compact, shift: k.compact?.shift ?? [0, k.shift?.[1] ?? 0] };
}

/** `compact` (state.compact, 0…1) ab 0,5 = kompakte Bühne. */
export function cameraAt(index: number, compact = 0): CamPose {
  const last = KEYFRAMES.length - 1;
  const x = Number.isNaN(index) ? 0 : Math.min(Math.max(index, 0), last);
  const i = Math.min(Math.floor(x), last - 1);
  const t = smooth(x - i);
  const c = compact >= 0.5;
  const a = resolve(KEYFRAMES[i], c);
  const b = resolve(KEYFRAMES[i + 1], c);
  const mix = (p: number, q: number): number => (x - i === 0 ? p : x - i === 1 ? q : p + (q - p) * t);
  return {
    position: [mix(a.position[0], b.position[0]), mix(a.position[1], b.position[1]), mix(a.position[2], b.position[2])],
    target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])],
    fov: mix(a.fov, b.fov),
    shift: [mix(a.shift?.[0] ?? 0, b.shift?.[0] ?? 0), mix(a.shift?.[1] ?? 0, b.shift?.[1] ?? 0)],
  };
}
