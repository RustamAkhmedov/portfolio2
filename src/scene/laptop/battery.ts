/*
 * Akku (`battery`): 75 Wh, 4 Zellen (4S1P) nebeneinander vorne unter der Handballenauflage,
 * Träger, BMS-Leiste an der Hinterkante und Kabel zum Board-Stecker.
 */
import { Mesh } from 'three';
import { addEdges, type Materials } from '../materials';
import { BATTERY, BATTERY_X_MAX, BOARD_TOP } from './dims';
import { ANCHOR, box, contentGroup, marker, merge, type PartBuild } from './geom';

export function buildBattery(materials: Materials): PartBuild {
  const b = BATTERY;
  const totalW = BATTERY_X_MAX - b.xMin;
  const cx = (b.xMin + BATTERY_X_MAX) / 2;
  const cellY = b.bottom + b.tray;
  const cellZ = b.zFront - b.cellDepth / 2;
  const bmsZ = b.zFront - b.cellDepth - b.bmsDepth / 2;
  const trayD = b.cellDepth + b.bmsDepth + 2;

  const pieces = [
    box(totalW + 4, b.tray, trayD, cx, b.bottom, b.zFront + 1 - trayD / 2),
    box(totalW, 1.0, b.bmsDepth - 0.5, cx, cellY, bmsZ),
    // Kabel zum Stecker vorne am Board (board.ts: x = −60, z = 20)
    box(6, 0.5, 9, -60, BOARD_TOP + 0.5, bmsZ - b.bmsDepth / 2 - 4),
  ];
  for (let i = 0; i < b.cells; i++) {
    const x = b.xMin + i * (b.cellWidth + b.cellGap) + b.cellWidth / 2;
    pieces.push(box(b.cellWidth, b.cellHeight, b.cellDepth, x, cellY, cellZ));
    // flaches Etikett ohne Text: zeichnet ein Innenrechteck je Zelle
    pieces.push(box(b.cellWidth - 14, 0.1, b.cellDepth - 20, x, cellY + b.cellHeight, cellZ));
  }

  const mesh = new Mesh(merge(pieces), materials.paper);
  mesh.name = 'battery';
  addEdges(mesh, 'ink', materials);

  const anchor = marker(ANCHOR, cx, cellY + b.cellHeight, cellZ);
  return { content: contentGroup(mesh, anchor) };
}
