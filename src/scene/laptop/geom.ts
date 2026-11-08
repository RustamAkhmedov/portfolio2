/*
 * Kleine Geometrie-Helfer für das prozedurale Laptop-Modell (alles in mm, siehe dims.ts).
 *
 * Grundriss-Formen (Shape/Path) werden in der x/z-Ebene gedacht: Formkoordinate (x, s) entspricht
 * Welt (x, -s) in z. extrudeUp() dreht die Extrusion so, dass sie entlang +y wächst.
 * Pro Teil werden alle Stücke mit gleichem Material zu EINER Geometrie zusammengeführt
 * (wenige Draw-Calls auf der iGPU) und die Kanten zu EINEM LineSegments.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Matrix4,
  Object3D,
  Path,
  Shape,
  type LineBasicMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE_ANGLE, type EdgeKind, type Materials } from '../materials';

/** Einheitliches Format für mergeGeometries: nicht indiziert, nur position + normal. */
export function clean(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  }
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  out.clearGroups();
  return out;
}

/** Führt Geometrien zu einer zusammen (die Eingaben werden verbraucht). */
export function merge(list: BufferGeometry[]): BufferGeometry {
  const cleaned = list.map(clean);
  const merged = mergeGeometries(cleaned, false);
  if (!merged) throw new Error('laptop: mergeGeometries fehlgeschlagen');
  cleaned.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Quader; x/z = Mitte, y = Unterkante. rotY dreht um die eigene Hochachse. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): BufferGeometry {
  const g = new BoxGeometry(w, h, d).translate(0, h / 2, 0);
  if (rotY) g.rotateY(rotY);
  return g.translate(x, y, z);
}

/** Quader zwischen zwei Punkten im Grundriss (Länge entlang a→b), y = Unterkante. */
export function beam(ax: number, az: number, bx: number, bz: number, width: number, h: number, y: number): BufferGeometry {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  return box(len, h, width, (ax + bx) / 2, y, (az + bz) / 2, Math.atan2(-dz, dx));
}

/** Stehender Zylinder; x/z = Mitte, y = Unterkante. */
export function cylY(r: number, h: number, x: number, y: number, z: number, segments = 16): BufferGeometry {
  return new CylinderGeometry(r, r, h, segments).translate(x, y + h / 2, z);
}

/** Liegender Zylinder entlang x; Mittelpunkt (x, y, z). */
export function cylX(r: number, len: number, x: number, y: number, z: number, segments = 12): BufferGeometry {
  return new CylinderGeometry(r, r, len, segments).rotateZ(Math.PI / 2).translate(x, y, z);
}

/** Zeichnet ein (abgerundetes) Rechteck im Grundriss in einen Pfad; cx/cz = Mitte, w entlang x, d entlang z. */
export function roundedRect<P extends Path>(p: P, cx: number, cz: number, w: number, d: number, r = 0): P {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const s0 = -cz - d / 2;
  const s1 = -cz + d / 2;
  const rr = Math.max(0, Math.min(r, w / 2, d / 2));
  if (rr === 0) {
    p.moveTo(x0, s0);
    p.lineTo(x1, s0);
    p.lineTo(x1, s1);
    p.lineTo(x0, s1);
    p.lineTo(x0, s0);
    return p;
  }
  p.moveTo(x0 + rr, s0);
  p.lineTo(x1 - rr, s0);
  p.absarc(x1 - rr, s0 + rr, rr, -Math.PI / 2, 0, false);
  p.lineTo(x1, s1 - rr);
  p.absarc(x1 - rr, s1 - rr, rr, 0, Math.PI / 2, false);
  p.lineTo(x0 + rr, s1);
  p.absarc(x0 + rr, s1 - rr, rr, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, s0 + rr);
  p.absarc(x0 + rr, s0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  return p;
}

export function roundedRectShape(cx: number, cz: number, w: number, d: number, r = 0): Shape {
  return roundedRect(new Shape(), cx, cz, w, d, r);
}

export function roundedRectHole(cx: number, cz: number, w: number, d: number, r = 0): Path {
  return roundedRect(new Path(), cx, cz, w, d, r);
}

export function circleHole(cx: number, cz: number, r: number): Path {
  const p = new Path();
  p.absarc(cx, -cz, r, 0, Math.PI * 2, false);
  return p;
}

/** Extrudiert eine Grundriss-Form von y0 nach oben um h. */
export function extrudeUp(shape: Shape, y0: number, h: number, curveSegments = 6): BufferGeometry {
  return new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments })
    .rotateX(-Math.PI / 2)
    .translate(0, y0, 0);
}

export function edgeMaterial(kind: EdgeKind, materials: Materials): LineBasicMaterial {
  return kind === 'case' ? materials.edgeOnCase : materials.edgeInk;
}

/** Kantenpositionen (Schwellwinkel wie addEdges) einer Geometrie. */
export function edgePositions(g: BufferGeometry, matrix?: Matrix4): Float32Array {
  const edges = new EdgesGeometry(g, EDGE_ANGLE);
  if (matrix) edges.applyMatrix4(matrix);
  const arr = (edges.getAttribute('position').array as Float32Array).slice();
  edges.dispose();
  return arr;
}

/** Ein LineSegments aus mehreren Kanten-Puffern (ein Draw-Call je Teil). Name 'edges' wie addEdges. */
export function linesFrom(chunks: Float32Array[], kind: EdgeKind, materials: Materials): LineSegments {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(all, 3));
  g.computeBoundingSphere();
  const lines = new LineSegments(g, edgeMaterial(kind, materials));
  lines.name = 'edges';
  return lines;
}

/** Name des Ankers eines Teils bzw. eines Anschlusses (`anchor:HDMI`). */
export const ANCHOR = 'anchor';
export const portAnchorName = (port: string): string => `${ANCHOR}:${port}`;

/** Leerer Ankerpunkt (für Beschriftungslinien), Position in mm im Teil-Inhalt. */
export function marker(name: string, x: number, y: number, z: number): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

/** Ergebnis eines Teil-Bauers: Inhalt in mm, im zusammengebauten Gerät positioniert. */
export interface PartBuild {
  content: Group;
}

/** Inhalt-Gruppe mit Meshes, Kanten und Ankern. */
export function contentGroup(...children: Object3D[]): Group {
  const g = new Group();
  g.name = 'content';
  if (children.length) g.add(...children);
  return g;
}

/** Wendet den Keil an: Eckpunkte auf y = 0 wandern auf die schräge Unterkante bottomFn(z). */
export function wedgeBottom(g: BufferGeometry, bottomFn: (z: number) => number, eps = 1e-4): BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i)) < eps) pos.setY(i, bottomFn(pos.getZ(i)));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Verschiebt alle Eckpunkte um bottomFn(z) nach oben (z. B. Wannenboden parallel zur Unterkante). */
export function liftBy(g: BufferGeometry, bottomFn: (z: number) => number): BufferGeometry {
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + bottomFn(pos.getZ(i)));
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

