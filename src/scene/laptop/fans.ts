/*
 * Kühlmodul (`fans`): 2 Radiallüfter links/rechts hinten, je ein Lamellenkühler an der Rückwand
 * (Auslass, Foto 02), 2 flache Heatpipes von der Kühlplatte auf der CPU zu den Kühlern.
 * Die Kühlplatte gehört zum Modul (wird mit ausgebaut).
 */
import { Mesh, Shape } from 'three';
import { addEdges, type Materials } from '../materials';
import { BOARD, BOARD_TOP, COLD_PLATE, CPU_TOP, FANS } from './dims';
import { ANCHOR, beam, box, circleHole, contentGroup, cylY, extrudeUp, marker, merge, type PartBuild } from './geom';
import type { BufferGeometry } from 'three';

const CURVE = 28;

/** Lüftergehäuse im Grundriss: Kreis + Auslass nach hinten zum Kühler (Formkoordinaten x, −z). */
function housingShape(cx: number, cz: number): Shape {
  const r = FANS.radius;
  const h = FANS.outletHalf;
  const sc = -cz;
  const sOut = -FANS.finZFront;
  const a0 = Math.acos(h / r);
  const s = new Shape();
  s.moveTo(cx + h, sOut);
  s.lineTo(cx - h, sOut);
  s.lineTo(cx + r * Math.cos(Math.PI - a0), sc + r * Math.sin(Math.PI - a0));
  s.absarc(cx, sc, r, Math.PI - a0, 2 * Math.PI + a0, false);
  s.lineTo(cx + h, sOut);
  s.holes.push(circleHole(cx, cz, FANS.inletRadius));
  return s;
}

function fan(sx: 1 | -1): BufferGeometry[] {
  const f = FANS;
  const cx = sx * f.centerX;
  const cz = f.centerZ;
  const out: BufferGeometry[] = [
    extrudeUp(housingShape(cx, cz), f.bottom, f.height, CURVE),
    cylY(f.inletRadius - 0.02, 0.5, cx, f.bottom, cz, CURVE),
    cylY(f.hubRadius, 4.5, cx, f.bottom + 0.5, cz, 20),
  ];
  // Schaufeln, leicht angestellt
  const rIn = f.hubRadius;
  const rOut = f.inletRadius - 1;
  const rm = (rIn + rOut) / 2;
  for (let k = 0; k < f.blades; k++) {
    const t = (k / f.blades) * Math.PI * 2;
    out.push(box(rOut - rIn, 4.2, 0.6, cx + rm * Math.cos(t), f.bottom + 0.6, cz + rm * Math.sin(t), -t + sx * 0.35));
  }
  // Lamellenkühler hinten
  const fw = 2 * f.outletHalf;
  const fd = f.finZFront - f.finZBack;
  const fz = (f.finZFront + f.finZBack) / 2;
  out.push(box(fw, 0.4, fd, cx, f.bottom, fz), box(fw, 0.4, fd, cx, f.finTop - 0.4, fz));
  const fins = 17;
  for (let i = 0; i < fins; i++) {
    const x = cx - f.outletHalf + 2 + (i * (fw - 4)) / (fins - 1);
    out.push(box(0.3, f.finTop - f.bottom - 0.8, fd, x, f.bottom + 0.4, fz));
  }
  // Heatpipe: Kühlplatte → Knick → über den Kühler
  const y = CPU_TOP + COLD_PLATE.thickness;
  const ax = sx * 12;
  const az = BOARD.cpu.z - 6;
  const kx = sx * 100;
  const ex = cx + sx * (f.outletHalf - 2);
  out.push(
    beam(ax, az, kx, fz, f.pipeWidth, f.pipeThickness, y),
    beam(kx, fz, ex, fz, f.pipeWidth, f.pipeThickness, y),
    cylY(f.pipeWidth / 2, f.pipeThickness, kx, y, fz, 12),
  );
  return out;
}

export function buildFans(materials: Materials): PartBuild {
  const cpu = BOARD.cpu;
  const pieces = [
    ...fan(-1),
    ...fan(1),
    // Kühlplatte auf der CPU mit vier Schraubpunkten
    box(COLD_PLATE.width, COLD_PLATE.thickness, COLD_PLATE.depth, cpu.x, CPU_TOP, cpu.z),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => cylY(2, CPU_TOP + 1.4 - BOARD_TOP, cpu.x + sx * 10, BOARD_TOP, cpu.z + sz * (COLD_PLATE.depth / 2 + 3), 10)),
    ),
  ];

  const mesh = new Mesh(merge(pieces), materials.paper);
  mesh.name = 'fans';
  addEdges(mesh, 'ink', materials);

  // Anker: Nabe des rechten Lüfters (Explosion fährt nach rechts).
  const anchor = marker(ANCHOR, FANS.centerX, FANS.bottom + 5, FANS.centerZ);
  return { content: contentGroup(mesh, anchor) };
}
