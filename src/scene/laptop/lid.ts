/*
 * Deckel (`lid`): Schale mit Display-Fläche 16:9 (15,6″), Kamera-Bucht im oberen Rahmen, Scharniere.
 * Klappt um die hintere Scharnierachse: Gruppe `lid` sitzt auf der Achse (Hinterkante, Deck-Oberseite),
 * darin die Pivot-Gruppe, die gedreht wird. Im Pivot liegt der Deckel zugeklappt von z = 0 (Achse)
 * bis z = Tiefe (Vorderkante), Display-Seite nach unten.
 */
import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';
import type { Materials } from '../materials';
import {
  BODY,
  CAMERA_BAY,
  DECK,
  DISPLAY,
  HALF_D,
  HINGE,
  LID_OPEN_DEG,
  LID_THICKNESS,
  MM,
} from './dims';
import { ANCHOR, box, contentGroup, cylX, cylY, edgePositions, extrudeUp, linesFrom, marker, merge, roundedRectShape } from './geom';

export interface LidRig {
  /** Teil-Gruppe `lid` (wird von der Explosion verschoben), sitzt auf der Scharnierachse. */
  group: Group;
  /** Dreht um x; 0 = zu, −110° = offen. */
  pivot: Group;
  /** Display-Fläche; Material mit austauschbarem `map` (T031). */
  screen: Mesh<PlaneGeometry, MeshBasicMaterial>;
}

export const LID_OPEN_RAD = MathUtils.degToRad(LID_OPEN_DEG);

/** Klappt den Deckel: 0 = zu, 1 = ~110° offen (Werte werden geklemmt). */
export function setLid(rig: LidRig, amount: number): void {
  const a = MathUtils.clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
  rig.pivot.rotation.x = -a * LID_OPEN_RAD;
}

/** Mitte der aktiven Fläche (z im Pivot, mm). */
export const SCREEN_Z = BODY.depth - DISPLAY.topBezel - DISPLAY.height / 2;

/**
 * Setzt die Projekt-Textur auf das Display (null = neutrale Fläche).
 * Farbe wird bei Textur weiß, damit die Textur unverfälscht erscheint.
 */
export function setScreenTexture(screen: Mesh<PlaneGeometry, MeshBasicMaterial>, texture: Texture | null): void {
  const mat = screen.material;
  const neutral = mat.userData['neutral'] as Color | undefined;
  if (mat.map !== texture) {
    mat.map = texture;
    mat.needsUpdate = true;
  }
  if (texture) mat.color.set(0xffffff);
  else if (neutral) mat.color.copy(neutral);
}

export function buildLid(materials: Materials): LidRig {
  const d = BODY.depth;

  const shell = extrudeUp(roundedRectShape(0, d / 2, BODY.width, d, BODY.cornerRadius), 0, LID_THICKNESS, 8);

  // Kamera-Bucht: flache Leiste im oberen Rahmen mit Linse und Sensor-Punkt.
  const bayZ = d - CAMERA_BAY.fromTop;
  const bay = box(CAMERA_BAY.width, CAMERA_BAY.raise, CAMERA_BAY.depth, 0, -CAMERA_BAY.raise, bayZ);
  const lens = cylY(CAMERA_BAY.lensRadius, 0.15, 0, -CAMERA_BAY.raise - 0.15, bayZ, 16);
  const sensor = cylY(0.6, 0.15, 9, -CAMERA_BAY.raise - 0.15, bayZ, 10);

  // Scharnier-Rollen an der Hinterkante, knapp vor der Achse (ragen zu nicht über den Grundriss hinaus).
  const hinges = [-1, 1].map((sx) => cylX(HINGE.radius, HINGE.length, sx * HINGE.x, 0, HINGE.radius, 12));

  const caseGeom = merge([shell, bay, lens, sensor, ...hinges]);
  const caseMesh = new Mesh(caseGeom, materials.case);
  caseMesh.name = 'lid-shell';

  // Display: Ebene knapp unter der Schale, Normale nach unten (zu) bzw. nach vorne (offen).
  // UV: u nach rechts (+x), v zur Vorderkante (= oben, wenn offen).
  const screenGeom = new PlaneGeometry(DISPLAY.width, DISPLAY.height).rotateX(Math.PI / 2).translate(0, -0.05, SCREEN_Z);
  const neutral = materials.edgeInk.color.clone();
  const screenMat = new MeshBasicMaterial({ color: neutral.clone() });
  screenMat.userData['neutral'] = neutral;
  const screen = new Mesh(screenGeom, screenMat);
  screen.name = 'screen';

  const edges = linesFrom([edgePositions(caseGeom), edgePositions(screenGeom)], 'case', materials);

  const anchor = marker(ANCHOR, 0, -0.1, SCREEN_Z);

  const content = contentGroup(caseMesh, screen, edges, anchor);
  content.scale.setScalar(MM);

  const pivot = new Group();
  pivot.name = 'lid-pivot';
  pivot.add(content);

  const group = new Group();
  group.name = 'lid';
  group.position.set(0, DECK.top * MM, -HALF_D * MM);
  group.add(pivot);

  return { group, pivot, screen };
}
