// Kamerapfad: ein Keyframe pro Stopp der Choreografie, SceneState.cam ist der stetige Index.
// Reine Daten und Funktion (keine three-Imports). Einheiten: 1 = 100 mm, Laptop ~3,54 × 2,47 um den Ursprung.
// Erste Schätzung ohne Modell – Feinabstimmung in T033 per Screenshots.

export type Vec3 = [number, number, number];
/** shift: Bildverschiebung als Anteil von Breite/Höhe (+x rechts, +y unten), Standard [0, 0] */
export type CamKey = { name: string; position: Vec3; target: Vec3; fov: number; shift?: [number, number] };
export type CamPose = { position: Vec3; target: Vec3; fov: number; shift: [number, number] };

/** Hero: 3/4 von vorne rechts, leicht von oben (entspricht grob HERO_POSE im Renderer, seitlich gedreht). */
// Mit 3D-Szene steht #scene rechts neben der Textspalte (layout.css, --scene-left); fov/shift sind darauf abgestimmt.
const HERO: CamKey = { name: 'outro', position: [4.6, 2.8, 6.6], target: [0, 0.6, 0], fov: 37, shift: [0, 0.075] };

export const KEYFRAMES: CamKey[] = [
  { ...HERO, name: 'hero' },
  // Totale: alle Teile der vollen Explosion im Bild (y ~ -1 bis 2,5+, x ~ -3,5 bis 2, Deckel hinten bei z ~ -2)
  // shift nach links: rechts daneben steht die Label-Spalte
  { name: 'total', position: [3.0, 6.2, 8.2], target: [-0.3, 1.3, -0.8], fov: 46, shift: [-0.17, 0.02] },
  // Display/Deckel (explodiert: Mitte ~ (0, 2.75, -3.5), Normale 20° nach oben): fast frontal und so hoch,
  // dass die angehobene Tastatur die Unterkante des Displays nicht verdeckt
  { name: 'projekte', position: [2.68, 7.97, 7.2], target: [0, 2.6, -3.9], fov: 40, shift: [0.05, -0.02] },
  // Mainboard: hinten mittig, von schräg oben
  { name: 'skills', position: [1.8, 3.8, 4.4], target: [0, 0.9, -0.6], fov: 28 },
  // Akku: vorne, etwas höher gehoben
  { name: 'ueber', position: [-1.4, 3.4, 5.2], target: [0, 1.3, 0.6], fov: 28 },
  // SSD: weiter oben
  { name: 'lebenslauf', position: [2.2, 4.4, 4.6], target: [0, 1.8, -0.2], fov: 28 },
  // Anschlüsse: nach links (-x) weggezogen, Blick von vorne links
  { name: 'kontakt', position: [-1.2, 1.8, 6.0], target: [-2.4, 0.3, 0], fov: 30 },
  { ...HERO, name: 'outro' },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function cameraAt(index: number): CamPose {
  const last = KEYFRAMES.length - 1;
  const x = Number.isNaN(index) ? 0 : Math.min(Math.max(index, 0), last);
  const i = Math.min(Math.floor(x), last - 1);
  const t = smooth(x - i);
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const mix = (p: number, q: number): number => (x - i === 0 ? p : x - i === 1 ? q : p + (q - p) * t);
  return {
    position: [mix(a.position[0], b.position[0]), mix(a.position[1], b.position[1]), mix(a.position[2], b.position[2])],
    target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])],
    fov: mix(a.fov, b.fov),
    shift: [mix(a.shift?.[0] ?? 0, b.shift?.[0] ?? 0), mix(a.shift?.[1] ?? 0, b.shift?.[1] ?? 0)],
  };
}
