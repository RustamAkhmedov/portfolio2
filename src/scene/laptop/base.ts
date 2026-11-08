/*
 * Unterteil-Wanne (`bottom`): Keil 13,9 → 15,9 mm Gesamthöhe (ohne Deckel 8,9 → 10,9 mm),
 * 353,6 × 246,9 mm, abgerundete Ecken. Offene Wanne aus Wandring + Boden, damit man nach der
 * Explosion von oben hineinsieht. Die Oberseite (Tastaturdeck) baut keyboard.ts.
 */
import { Mesh } from 'three';
import { addEdges, type Materials } from '../materials';
import { BODY, DECK, HALF_D, HALF_W, SHELL, bottomY, floorTopY } from './dims';
import {
  ANCHOR,
  box,
  contentGroup,
  extrudeUp,
  liftBy,
  marker,
  merge,
  roundedRectHole,
  roundedRectShape,
  wedgeBottom,
  type PartBuild,
} from './geom';

/** Außenkontur des Geräts im Grundriss (auch für Deck und Deckel). */
export function outlineShape() {
  return roundedRectShape(0, 0, BODY.width, BODY.depth, BODY.cornerRadius);
}

export function buildBottom(materials: Materials): PartBuild {
  const t = SHELL.wall;
  const innerW = BODY.width - 2 * t;
  const innerD = BODY.depth - 2 * t;
  const innerR = BODY.cornerRadius - t;

  // Wandring: von y = 0 bis unter das Deck, Unterkante danach auf den Keil gezogen.
  const ring = outlineShape();
  ring.holes.push(roundedRectHole(0, 0, innerW, innerD, innerR));
  const walls = wedgeBottom(extrudeUp(ring, 0, DECK.bottom, 8), bottomY);

  // Boden innerhalb der Wände, parallel zur schrägen Unterkante.
  const floor = liftBy(extrudeUp(roundedRectShape(0, 0, innerW, innerD, innerR), 0, SHELL.floor, 8), bottomY);

  // Zwei Längsrippen hinten als Auflage fürs Board (sieht man nach der Explosion in der Wanne).
  const ribs = [-60, 60].map((x) => box(1.2, 1.6, 90, x, floorTopY(-105) - 0.2, -60));

  const mesh = new Mesh(merge([walls, floor, ...ribs]), materials.case);
  mesh.name = 'bottom-shell';
  addEdges(mesh, 'case', materials);

  // Anker: Boden vorne rechts (von oben sichtbar, wenn die Wanne nach unten fährt).
  const za = HALF_D - 30;
  const anchor = marker(ANCHOR, HALF_W - 40, floorTopY(za), za);

  return { content: contentGroup(mesh, anchor) };
}
