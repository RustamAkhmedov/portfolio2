/*
 * Baut den Laptop aus den Teilen in parts.json (Feld `key`). Jedes Teil ist eine eigene Group mit
 * Name = key; ihre position ist die Ruhelage im zusammengebauten Gerät (Szeneneinheiten, 1 = 100 mm),
 * die Explosion verschiebt nur group.position. Geometrie wird in mm gebaut und im Teil-Inhalt skaliert.
 *
 * Anker: anchors[key] (je Teil) und anchors['TB4-1'] usw. (je Anschluss) sind Weltpunkte. Sie stimmen
 * nach dem Bau für den Ausgangszustand; nach Änderungen an Explosion/Deckel updateAnchors() aufrufen.
 */
import { Box3, Group, Vector3, type Mesh, type MeshBasicMaterial, type Object3D, type PlaneGeometry } from 'three';
import type { Materials } from '../materials';
import { buildBottom } from './base';
import { buildBattery } from './battery';
import { buildBoard } from './board';
import { CHIP_ANCHORS, MM, PORTS } from './dims';
import { buildFans } from './fans';
import { ANCHOR, chipAnchorName, portAnchorName, type PartBuild } from './geom';
import { buildKeyboard } from './keyboard';
import { buildLid, setLid as setLidRig, type LidRig } from './lid';
import { buildPorts } from './ports';
import { buildSsd } from './ssd';

export { LID_OPEN_RAD, setLid, setScreenTexture, type LidRig } from './lid';

/** Die Teile, die das Modell kennt (= keys in parts.json). */
export const PART_KEYS = ['lid', 'board', 'battery', 'ssd', 'ports', 'keyboard', 'fans', 'bottom'] as const;
export type PartKey = (typeof PART_KEYS)[number];

/** Nur das Feld, das die Szene aus parts.json braucht. */
export interface PartRef {
  key: string;
}

export interface Laptop {
  root: Group;
  /** Teil-Gruppen nach key */
  parts: Record<string, Group>;
  /** Ruhelage je Teil (Kopie von group.position nach dem Bau) */
  restPositions: Record<string, Vector3>;
  /** 0 = zu, 1 = ~110° offen */
  setLid(amount: number): void;
  /** Weltpunkte je Teil-key, je Anschluss (TB4-1, TB4-2, HDMI, USB-A-1, USB-A-2, microSD, Audio) und je Chip (`chip:CPU` …) */
  anchors: Record<string, Vector3>;
  /** Rechnet anchors aus den aktuellen Transformationen neu (dieselben Vector3-Objekte). */
  updateAnchors(): void;
  /** Display-Fläche; Material mit austauschbarem map (siehe setScreenTexture). */
  screenMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  lid: LidRig;
}

type Builder = (m: Materials) => PartBuild;

const BUILDERS: Record<Exclude<PartKey, 'lid'>, Builder> = {
  bottom: buildBottom,
  keyboard: buildKeyboard,
  board: buildBoard,
  battery: buildBattery,
  ssd: buildSsd,
  fans: buildFans,
  ports: buildPorts,
};

function isPartKey(key: string): key is PartKey {
  return (PART_KEYS as readonly string[]).includes(key);
}

/** Teil-Gruppe: Inhalt (mm) skaliert, Gruppe auf die Mitte des Teils gesetzt (Ruhelage). */
function wrap(key: string, build: PartBuild): Group {
  const content = build.content;
  const box = new Box3().setFromObject(content);
  const center = box.getCenter(new Vector3()).multiplyScalar(MM);
  content.scale.setScalar(MM);
  content.position.copy(center).negate();
  const group = new Group();
  group.name = key;
  group.position.copy(center);
  group.add(content);
  return group;
}

export function buildLaptop(parts: readonly PartRef[], materials: Materials): Laptop {
  const root = new Group();
  root.name = 'laptop';
  const groups: Record<string, Group> = {};
  let lid: LidRig | null = null;

  for (const { key } of parts) {
    if (!isPartKey(key)) throw new Error(`laptop: unbekanntes Teil "${key}"`);
    if (groups[key]) throw new Error(`laptop: Teil "${key}" doppelt`);
    let group: Group;
    if (key === 'lid') {
      lid = buildLid(materials);
      group = lid.group;
    } else {
      group = wrap(key, BUILDERS[key](materials));
    }
    groups[key] = group;
    root.add(group);
  }
  // Das Display gibt es immer (Projekt-Textur), notfalls ohne Eintrag in parts.json unsichtbar.
  if (!lid) {
    lid = buildLid(materials);
    lid.group.visible = false;
  }
  const lidRig: LidRig = lid;

  const restPositions: Record<string, Vector3> = {};
  for (const [key, g] of Object.entries(groups)) restPositions[key] = g.position.clone();

  // Anker-Objekte einsammeln
  const markers: Record<string, Object3D> = {};
  for (const [key, g] of Object.entries(groups)) {
    const a = g.getObjectByName(ANCHOR);
    if (a) markers[key] = a;
  }
  const ports = groups['ports'];
  if (ports) {
    for (const p of PORTS) {
      const a = ports.getObjectByName(portAnchorName(p.name));
      if (a) markers[p.name] = a;
    }
  }
  const board = groups['board'];
  if (board) {
    for (const c of CHIP_ANCHORS) {
      const a = board.getObjectByName(chipAnchorName(c.name));
      if (a) markers[`chip:${c.name}`] = a;
    }
  }
  const anchors: Record<string, Vector3> = {};
  for (const name of Object.keys(markers)) anchors[name] = new Vector3();

  function updateAnchors(): void {
    root.updateMatrixWorld(true);
    for (const [name, m] of Object.entries(markers)) m.getWorldPosition(anchors[name]!);
  }
  updateAnchors();

  return {
    root,
    parts: groups,
    restPositions,
    setLid(amount: number) {
      setLidRig(lidRig, amount);
    },
    anchors,
    updateAnchors,
    screenMesh: lidRig.screen,
    lid: lidRig,
  };
}

/** Anzahl der Draw-Calls (sichtbare Meshes, InstancedMeshes, Linien) unter einem Objekt. */
export function countDrawCalls(obj: Object3D): number {
  let n = 0;
  obj.traverseVisible((o) => {
    const r = o as Object3D & { isMesh?: boolean; isLine?: boolean };
    if (r.isMesh || r.isLine) n++;
  });
  return n;
}
