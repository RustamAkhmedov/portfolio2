/*
 * Tastaturdeck (`keyboard`): Deckplatte mit Tastaturmulde und Touchpad (7,1″), Chiclet-Tasten als
 * EIN InstancedMesh (Hauptblock 15 u + schmaler Numpad mit 3 Spalten, Foto 03).
 * Draw-Calls: Deck (1) + Tasten (1) + Kanten (1, Tastenkanten eingebacken).
 */
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { Materials } from '../materials';
import { outlineShape } from './base';
import { DECK, HALF_D, KEYBOARD, KEYBOARD_DEPTH, KEYBOARD_WIDTH, TOUCHPAD } from './dims';
import {
  ANCHOR,
  contentGroup,
  edgePositions,
  extrudeUp,
  linesFrom,
  marker,
  merge,
  roundedRectHole,
  roundedRectShape,
  type PartBuild,
} from './geom';

/** Rechteck einer Taste im Grundriss (mm). */
export interface KeyRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

type Slot = number | { skip: number } | { w: number; half: 'bottom' } | { w: number; stack: true };

/** Reihen 1–5 des Hauptblocks in u (Summe je Reihe = 15 u). */
const MAIN_ROWS: Slot[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], // ` 1 … = Backspace
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], // Tab Q … ] \
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25], // Caps A … ' Enter
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75], // Shift Z … / Shift
  // Ctrl Fn Win Alt Space Alt Copilot | ← ↑↓ →
  [1, 1, 1, 1, 5.5, 1, 1, { skip: 0.5 }, { w: 1, half: 'bottom' }, { w: 1, stack: true }, { w: 1, half: 'bottom' }],
];
const FN_KEYS = 16;

/** Alle Tastenrechtecke (Reihenfolge: Fn-Reihe, Reihen 1–5, je Hauptblock dann Numpad). */
export function keyLayout(): KeyRect[] {
  const k = KEYBOARD;
  const keys: KeyRect[] = [];
  const x0 = -KEYBOARD_WIDTH / 2;
  const zb = -HALF_D + k.fromBack;
  const numX0 = x0 + 15 * k.pitch + k.numGap;
  const halfDepth = (k.keyDepth - k.gap) / 2;

  const push = (xa: number, xb: number, za: number, d: number): void => {
    keys.push({ x: (xa + xb) / 2, z: za + d / 2, w: xb - xa, d });
  };
  const numpad = (za: number, d: number): void => {
    for (let c = 0; c < k.numCols; c++) {
      push(numX0 + c * k.numPitch + k.gap / 2, numX0 + (c + 1) * k.numPitch - k.gap / 2, za, d);
    }
  };

  // Fn-Reihe: 16 gleich breite Tasten über den Hauptblock + 3 im Numpad.
  const fnPitch = (15 * k.pitch) / FN_KEYS;
  for (let i = 0; i < FN_KEYS; i++) {
    push(x0 + i * fnPitch + k.gap / 2, x0 + (i + 1) * fnPitch - k.gap / 2, zb, k.fnDepth);
  }
  numpad(zb, k.fnDepth);

  MAIN_ROWS.forEach((row, r) => {
    const za = zb + k.fnOffset + r * k.rowPitch;
    let u = 0;
    for (const slot of row) {
      if (typeof slot === 'object' && 'skip' in slot) {
        u += slot.skip;
        continue;
      }
      const w = typeof slot === 'number' ? slot : slot.w;
      const xa = x0 + u * k.pitch + k.gap / 2;
      const xb = x0 + (u + w) * k.pitch - k.gap / 2;
      if (typeof slot === 'number') {
        push(xa, xb, za, k.keyDepth);
      } else if ('half' in slot) {
        push(xa, xb, za + k.keyDepth - halfDepth, halfDepth);
      } else {
        push(xa, xb, za, halfDepth);
        push(xa, xb, za + k.keyDepth - halfDepth, halfDepth);
      }
      u += w;
    }
    if (Math.abs(u - 15) > 1e-9) throw new Error(`keyboard: Reihe ${r + 1} hat ${u} u statt 15 u`);
    numpad(za, k.keyDepth);
  });
  return keys;
}

/** Tastaturmulde im Deck (mm, Mitte + Größe). */
export function keyboardWell(): KeyRect {
  const m = KEYBOARD.wellMargin;
  return {
    x: 0,
    z: -HALF_D + KEYBOARD.fromBack + KEYBOARD_DEPTH / 2,
    w: KEYBOARD_WIDTH + 2 * m,
    d: KEYBOARD_DEPTH + 2 * m,
  };
}

/** Touchpad-Fläche (mm, ohne Spalt). */
export function touchpadRect(): KeyRect {
  return {
    x: TOUCHPAD.centerX,
    z: HALF_D - TOUCHPAD.fromFront - TOUCHPAD.depth / 2,
    w: TOUCHPAD.width,
    d: TOUCHPAD.depth,
  };
}

export function buildKeyboard(materials: Materials): PartBuild {
  const well = keyboardWell();
  const pad = touchpadRect();
  const g = TOUCHPAD.gap;

  const deckShape = outlineShape();
  deckShape.holes.push(roundedRectHole(well.x, well.z, well.w, well.d, 1.5));
  deckShape.holes.push(roundedRectHole(pad.x, pad.z, pad.w + 2 * g, pad.d + 2 * g, 2));
  const deck = extrudeUp(deckShape, DECK.bottom, DECK.thickness, 8);

  // Trägerplatte unter der Mulde (Boden der Tastaturmulde).
  const plate = extrudeUp(
    roundedRectShape(well.x, well.z, well.w + 4, well.d + 4, 1.5),
    DECK.bottom - KEYBOARD.plate,
    KEYBOARD.plate,
  );
  // Touchpad knapp unter der Deck-Oberfläche.
  const padTop = DECK.top - 0.15;
  const touch = extrudeUp(roundedRectShape(pad.x, pad.z, pad.w, pad.d, 1.6), padTop - TOUCHPAD.thickness, TOUCHPAD.thickness);

  const deckGeom = merge([deck, plate, touch]);
  const deckMesh = new Mesh(deckGeom, materials.case);
  deckMesh.name = 'deck';

  // Tasten: ein InstancedMesh, Einheitswürfel mit Unterkante auf 0.
  const layout = keyLayout();
  const unit = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const keys = new InstancedMesh(unit, materials.case, layout.length);
  keys.name = 'keys';
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const unitEdges = edgePositions(unit);
  const keyEdges = new Float32Array(unitEdges.length * layout.length);
  const v = new Vector3();
  layout.forEach((key, i) => {
    p.set(key.x, DECK.bottom, key.z);
    s.set(key.w, KEYBOARD.keyHeight, key.d);
    m.compose(p, q, s);
    keys.setMatrixAt(i, m);
    // Kanten der Taste in einen gemeinsamen Puffer einbacken.
    for (let j = 0; j < unitEdges.length; j += 3) {
      v.set(unitEdges[j]!, unitEdges[j + 1]!, unitEdges[j + 2]!).applyMatrix4(m);
      const o = i * unitEdges.length + j;
      keyEdges[o] = v.x;
      keyEdges[o + 1] = v.y;
      keyEdges[o + 2] = v.z;
    }
  });
  keys.instanceMatrix.needsUpdate = true;
  keys.computeBoundingBox();
  keys.computeBoundingSphere();

  const edges = linesFrom([edgePositions(deckGeom), keyEdges], 'case', materials);

  // Anker: rechte Hälfte des Hauptblocks (bleibt neben dem Touchpad frei für das Label).
  const anchor = marker(ANCHOR, well.x + well.w * 0.25, DECK.top, well.z);

  return { content: contentGroup(deckMesh, keys, edges, anchor) };
}
