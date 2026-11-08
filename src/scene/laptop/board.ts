/*
 * Mainboard (`board`): Platine hinten mittig zwischen den Lüftern, Lasche vorne rechts mit M.2-Steckplatz,
 * CPU (Package + Tiles), 4 × LPDDR5X (verlötet), Spulen, Stecker. Stilisiert (kein Teardown verfügbar).
 * Innenteile sind Papier mit Tuschekanten: ein Mesh + ein LineSegments.
 */
import { Mesh, Shape } from 'three';
import { addEdges, type Materials } from '../materials';
import { BOARD, BOARD_TOP, CPU_TOP, SSD } from './dims';
import { ANCHOR, box, contentGroup, extrudeUp, marker, merge, type PartBuild } from './geom';

/** Umriss der Platine im Grundriss (Formkoordinaten: x, −z). */
function boardShape(): Shape {
  const b = BOARD;
  const pts: [number, number][] = [
    [b.xMin, b.zBack],
    [b.xMax, b.zBack],
    [b.xMax, b.tab.zBack],
    [b.tab.xMax, b.tab.zBack],
    [b.tab.xMax, b.tab.zFront],
    [b.tab.xMin, b.tab.zFront],
    [b.tab.xMin, b.zFront],
    [b.xMin, b.zFront],
  ];
  const s = new Shape();
  pts.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
  s.lineTo(pts[0]![0], -pts[0]![1]);
  return s;
}

export function buildBoard(materials: Materials): PartBuild {
  const top = BOARD_TOP;
  const cpu = BOARD.cpu;
  const dieY = top + cpu.substrate;
  const parts = [
    extrudeUp(boardShape(), BOARD.bottom, BOARD.thickness),
    // CPU: Substrat + Compute-, GPU- und SoC-Tile
    box(cpu.width, cpu.substrate, cpu.depth, cpu.x, top, cpu.z),
    box(16, cpu.die, 11, cpu.x - 9, dieY, cpu.z - 5.5),
    box(12, cpu.die, 11, cpu.x + 7, dieY, cpu.z - 5.5),
    box(30, cpu.die, 7, cpu.x, dieY, cpu.z + 6.5),
    // LPDDR5X vor der CPU
    ...BOARD.ram.xs.map((x) => box(BOARD.ram.width, BOARD.ram.height, BOARD.ram.depth, x, top, BOARD.ram.z)),
    // Spulen der Spannungsversorgung hinter der CPU (flach, unter den Heatpipes)
    ...Array.from({ length: 6 }, (_, i) => box(5, 2, 5, -40 + i * 8, top, -96)),
    // Akku-Stecker vorne, M.2-Steckplatz auf der Lasche
    box(16, 2, 5, -60, top, 20),
    box(SSD.width, 2.2, 5, SSD.x, top, SSD.zBack + 2),
    // Funkmodul, Controller, Lüfter-Stecker
    box(22, 1.2, 30, -70, top, -10),
    box(8, 0.8, 8, 55, top, -15),
    box(10, 1, 10, 30, top, -2),
    box(6, 1.5, 4, -88, top, -70),
    box(6, 1.5, 4, 88, top, -70),
  ];

  const mesh = new Mesh(merge(parts), materials.paper);
  mesh.name = 'board';
  addEdges(mesh, 'ink', materials);

  const anchor = marker(ANCHOR, cpu.x, CPU_TOP, cpu.z);
  return { content: contentGroup(mesh, anchor) };
}
