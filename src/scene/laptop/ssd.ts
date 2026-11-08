/*
 * SSD (`ssd`): M.2 2280 (22 × 80 mm) rechts neben dem Akku, Steckerseite im Steckplatz auf der
 * Board-Lasche, Controller + 2 NAND, Schraube am Ende.
 */
import { Mesh } from 'three';
import { addEdges, type Materials } from '../materials';
import { SSD } from './dims';
import { ANCHOR, box, contentGroup, cylY, marker, merge, type PartBuild } from './geom';

export function buildSsd(materials: Materials): PartBuild {
  const s = SSD;
  const top = s.bottom + s.thickness;
  const zMid = s.zBack + s.length / 2;
  const pieces = [
    box(s.width, s.thickness, s.length, s.x, s.bottom, zMid),
    // Kontaktleiste (Key M) an der Steckerseite
    box(s.width - 4, 0.15, 3.5, s.x, top, s.zBack + 2),
    // Controller und zwei NAND-Bausteine (ohne Beschriftung)
    box(12, 1.0, 12, s.x, top, s.zBack + 14),
    box(15, 1.1, 16, s.x, top, s.zBack + 34),
    box(15, 1.1, 16, s.x, top, s.zBack + 55),
    // Halteschraube am Ende
    cylY(2.4, 1.0, s.x, top, s.zBack + s.length - 2.5, 14),
  ];

  const mesh = new Mesh(merge(pieces), materials.paper);
  mesh.name = 'ssd';
  addEdges(mesh, 'ink', materials);

  const anchor = marker(ANCHOR, s.x, top + 1.1, zMid);
  return { content: contentGroup(mesh, anchor) };
}
