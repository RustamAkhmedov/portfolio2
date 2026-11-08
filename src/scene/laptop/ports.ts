/*
 * Anschlüsse (`ports`): links HDMI, 2 × Thunderbolt 4 (USB-C), microSD, Klinke; rechts 2 × USB-A
 * (Fotos 06/07). Jede Buchse ist ein Rahmen mit Öffnung, der knapp vor der Seitenwand sitzt: Durch die
 * Öffnung sieht man die dunkle Gehäusewand, das liest sich als Loch. Dazu je Seite eine I/O-Leiste.
 * Ein Anker je Anschluss (contact.json `port`), benannt `anchor:<Name>`.
 */
import { BoxGeometry, ExtrudeGeometry, Mesh, Path, Shape, type BufferGeometry } from 'three';
import { addEdges, type Materials } from '../materials';
import {
  HALF_W,
  PORTS,
  PORT_PROUD,
  PORT_SHAPES,
  SHELL,
  floorTopY,
  portCenterY,
  portZ,
  type PortDef,
  type PortKind,
} from './dims';
import { ANCHOR, box, contentGroup, marker, merge, portAnchorName, roundedRect, type PartBuild } from './geom';

/** Polygon (u, v) symmetrisch um 0, für HDMI mit abgeschrägten unteren Ecken. */
function hdmiPath<P extends Path>(p: P, w: number, h: number, chamfer: number): P {
  const x = w / 2;
  const y = h / 2;
  p.moveTo(-x, y);
  p.lineTo(x, y);
  p.lineTo(x, -y + chamfer);
  p.lineTo(x - chamfer * 1.4, -y);
  p.lineTo(-x + chamfer * 1.4, -y);
  p.lineTo(-x, -y + chamfer);
  p.lineTo(-x, y);
  return p;
}

function circlePath<P extends Path>(p: P, r: number): P {
  p.absarc(0, 0, r, 0, Math.PI * 2, false);
  return p;
}

/** Stirnform (Rahmen mit Öffnung) in der Ebene u (waagrecht) / v (senkrecht). */
function faceShape(kind: PortKind): Shape {
  const s = PORT_SHAPES[kind];
  switch (kind) {
    case 'hdmi': {
      const shape = hdmiPath(new Shape(), s.outerW, s.outerH, 1.6);
      shape.holes.push(hdmiPath(new Path(), s.innerW, s.innerH, 1.2));
      return shape;
    }
    case 'usbc': {
      const shape = roundedRect(new Shape(), 0, 0, s.outerW, s.outerH, s.outerH / 2);
      shape.holes.push(roundedRect(new Path(), 0, 0, s.innerW, s.innerH, s.innerH / 2));
      return shape;
    }
    case 'audio': {
      const shape = circlePath(new Shape(), s.outerW / 2);
      shape.holes.push(circlePath(new Path(), s.innerW / 2));
      return shape;
    }
    default: {
      const shape = roundedRect(new Shape(), 0, 0, s.outerW, s.outerH, 0.4);
      shape.holes.push(roundedRect(new Path(), 0, 0, s.innerW, s.innerH, 0.2));
      return shape;
    }
  }
}

/** Buchse in lokalen Koordinaten: u = x, v = y, Einbautiefe entlang +z (0 = Stirnfläche). */
function connector(kind: PortKind): BufferGeometry[] {
  const s = PORT_SHAPES[kind];
  const out: BufferGeometry[] = [];
  // ExtrudeGeometry direkt (ohne Drehung nach oben): Tiefe entlang +z
  out.push(extrudeFace(faceShape(kind), s.depth));
  // Rückwand der Buchse
  out.push(new BoxGeometry(s.outerW, s.outerH, 0.5).translate(0, 0, s.depth - 0.25));
  // Zungen im Inneren; Stirn knapp vor der Gehäusewand, damit sie zusammengebaut in der Öffnung sichtbar sind
  const front = 0.05;
  if (kind === 'usbc') out.push(new BoxGeometry(s.innerW - 1.8, 0.7, s.depth - front - 0.5).translate(0, 0, (s.depth + front - 0.5) / 2));
  if (kind === 'usba') out.push(new BoxGeometry(s.innerW - 1.4, 1.8, s.depth - front - 0.5).translate(0, 1.1, (s.depth + front - 0.5) / 2));
  return out;
}

/** Stirnform entlang +z extrudieren (ohne Drehung, anders als extrudeUp). */
function extrudeFace(shape: Shape, depth: number): BufferGeometry {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
}

/** Buchse an ihre Stelle in der Seitenwand setzen. */
function placed(p: PortDef): BufferGeometry[] {
  const left = p.side === 'left';
  const x = left ? -HALF_W - PORT_PROUD : HALF_W + PORT_PROUD;
  const y = portCenterY(portZ(p));
  const z = portZ(p);
  return connector(p.kind).map((g) => g.rotateY(left ? Math.PI / 2 : -Math.PI / 2).translate(x, y, z));
}

/** I/O-Leiste unter den Buchsen einer Seite. */
function ioStrip(side: 'left' | 'right'): BufferGeometry {
  const list = PORTS.filter((p) => p.side === side);
  const zs = list.map(portZ);
  const z0 = Math.min(...zs) - 10;
  const z1 = Math.max(...zs) + 8;
  const lowest = Math.min(...list.map((p) => portCenterY(portZ(p)) - PORT_SHAPES[p.kind].outerH / 2));
  const t = 0.8;
  const w = 10;
  const sx = side === 'left' ? -1 : 1;
  const x = sx * (HALF_W - SHELL.wall - w / 2 - 0.2);
  const y = Math.max(floorTopY(z1) + 0.1, lowest - 0.05 - t);
  return box(w, t, z1 - z0, x, y, (z0 + z1) / 2);
}

export function buildPorts(materials: Materials): PartBuild {
  const pieces = [...PORTS.flatMap(placed), ioStrip('left'), ioStrip('right')];
  const mesh = new Mesh(merge(pieces), materials.paper);
  mesh.name = 'ports';
  addEdges(mesh, 'ink', materials);

  const out = HALF_W + PORT_PROUD + 0.5;
  const anchors = PORTS.map((p) =>
    marker(portAnchorName(p.name), p.side === 'left' ? -out : out, portCenterY(portZ(p)), portZ(p)),
  );
  // Teil-Anker: linke Seite zwischen den beiden TB4 (Explosion fährt nach links).
  const tb = PORTS.filter((p) => p.kind === 'usbc');
  const zMid = tb.reduce((s, p) => s + portZ(p), 0) / Math.max(1, tb.length);
  const anchor = marker(ANCHOR, -out, portCenterY(zMid), zMid);

  return { content: contentGroup(mesh, anchor, ...anchors) };
}
