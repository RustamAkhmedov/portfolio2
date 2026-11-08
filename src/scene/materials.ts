/*
 * Materialien der Explosionszeichnung (docs/design.md, research.md R2).
 * Farben werden einmalig aus den CSS-Tokens gelesen (--paper, --case, --case-edge, --ink, --orange).
 * Materialien werden geteilt, nicht pro Mesh neu angelegt.
 */
import {
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshLambertMaterial,
  type Mesh,
} from 'three';

export type EdgeKind = 'case' | 'ink';

export interface Materials {
  paper: MeshLambertMaterial;
  case: MeshLambertMaterial;
  /** Ghost: reine Linien, keine Füllung (Fläche unsichtbar, Tiefe bleibt unberührt). */
  ghost: MeshLambertMaterial;
  focus: MeshLambertMaterial;
  edgeOnCase: LineBasicMaterial;
  edgeInk: LineBasicMaterial;
}

/** Fallbacks nur, falls eine Variable leer ist (z. B. Tokens noch nicht geladen). */
const FALLBACK = {
  '--paper': '#E7E3D8',
  '--ink': '#1B2230',
  '--orange': '#FF5F1F',
  '--case': '#2E3036',
  '--case-edge': '#CFC9BA',
} as const;

const EDGE_ANGLE = 30;
const CASE_EDGE_OPACITY = 0.6;

function readColor(name: keyof typeof FALLBACK): Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(value || FALLBACK[name]);
}

export function createMaterials(): Materials {
  const paper = readColor('--paper');
  const ink = readColor('--ink');
  const orange = readColor('--orange');
  const caseColor = readColor('--case');
  const caseEdge = readColor('--case-edge');

  const ghost = new MeshLambertMaterial({ color: paper, transparent: true, opacity: 0, depthWrite: false });
  ghost.visible = true;

  return {
    paper: new MeshLambertMaterial({ color: paper }),
    case: new MeshLambertMaterial({ color: caseColor }),
    ghost,
    focus: new MeshLambertMaterial({ color: orange }),
    edgeOnCase: new LineBasicMaterial({ color: caseEdge, transparent: true, opacity: CASE_EDGE_OPACITY }),
    edgeInk: new LineBasicMaterial({ color: ink }),
  };
}

/** Hängt Kantenlinien (Schwellwinkel 30°) als Kind an das Mesh und gibt sie zurück. */
export function addEdges(mesh: Mesh, kind: EdgeKind, materials: Materials): LineSegments {
  const lines = new LineSegments(
    new EdgesGeometry(mesh.geometry, EDGE_ANGLE),
    kind === 'case' ? materials.edgeOnCase : materials.edgeInk,
  );
  lines.name = 'edges';
  mesh.add(lines);
  return lines;
}
