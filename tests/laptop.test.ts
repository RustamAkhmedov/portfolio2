// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Box3, InstancedMesh, LineSegments, Mesh, Vector3, type Object3D } from 'three';
import { createMaterials } from '../src/scene/materials';
import {
  BASE_HEIGHT_BACK,
  BASE_HEIGHT_FRONT,
  BATTERY,
  BATTERY_X_MAX,
  BODY,
  DECK,
  DISPLAY,
  HALF_D,
  HALF_W,
  KEYBOARD,
  KEYBOARD_DEPTH,
  KEYBOARD_WIDTH,
  LID_OPEN_DEG,
  LID_THICKNESS,
  MM,
  PORTS,
  SSD,
  TOUCHPAD,
  bottomY,
} from '../src/scene/laptop/dims';
import { keyLayout, keyboardWell, touchpadRect } from '../src/scene/laptop/keyboard';
import { buildLaptop, countDrawCalls, setScreenTexture } from '../src/scene/laptop';
import { Texture } from 'three';

const root = resolve(__dirname, '..');
const parts = JSON.parse(readFileSync(join(root, 'src/content/parts.json'), 'utf8')) as { key: string }[];
const contact = JSON.parse(readFileSync(join(root, 'src/content/contact.json'), 'utf8')) as { port: string }[];
const readme = readFileSync(join(root, 'docs/referenz/laptop/README.md'), 'utf8');

const INCH = 25.4;
const mm = (v: number) => v / MM;
/** Bounding-Box in mm (Welt), ohne Kantenlinien */
function boxMm(obj: Object3D): Box3 {
  obj.updateWorldMatrix(true, true);
  const b = new Box3();
  obj.traverse((o) => {
    if (o instanceof Mesh) b.expandByObject(o, true);
  });
  return new Box3(b.min.clone().multiplyScalar(1 / MM), b.max.clone().multiplyScalar(1 / MM));
}

describe('dims.ts stimmt mit docs/referenz/laptop/README.md überein', () => {
  it('Breite × Tiefe und Keilhöhe', () => {
    expect(readme).toContain('353,6 × 246,9 mm');
    expect(readme).toContain('13,9 mm (vorne) bis 15,9 mm (hinten)');
    expect(BODY.width).toBe(353.6);
    expect(BODY.depth).toBe(246.9);
    expect(BODY.heightFront).toBe(13.9);
    expect(BODY.heightBack).toBe(15.9);
    expect(BASE_HEIGHT_FRONT + LID_THICKNESS).toBeCloseTo(13.9, 6);
    expect(BASE_HEIGHT_BACK + LID_THICKNESS).toBeCloseTo(15.9, 6);
    expect(DECK.top - bottomY(HALF_D)).toBeCloseTo(BASE_HEIGHT_FRONT, 6);
    expect(DECK.top - bottomY(-HALF_D)).toBeCloseTo(BASE_HEIGHT_BACK, 6);
  });

  it('Display 15,6″ 16:9', () => {
    expect(readme).toContain('15,6″ OLED, 2880 × 1620 (16:9)');
    expect(DISPLAY.width / DISPLAY.height).toBeCloseTo(16 / 9, 6);
    expect(Math.hypot(DISPLAY.width, DISPLAY.height) / INCH).toBeCloseTo(15.6, 3);
    expect(DISPLAY.width).toBeLessThan(BODY.width);
    expect(DISPLAY.topBezel + DISPLAY.height).toBeLessThan(BODY.depth);
  });

  it('Touchpad ≈ 7,1″, Tastatur passt aufs Deck, Touchpad liegt vor der Tastatur', () => {
    expect(readme).toContain('7,1″');
    expect(Math.hypot(TOUCHPAD.width, TOUCHPAD.depth) / INCH).toBeCloseTo(7.1, 1);
    const well = keyboardWell();
    const pad = touchpadRect();
    expect(well.w).toBeLessThan(BODY.width - 20);
    expect(pad.z - pad.d / 2).toBeGreaterThan(well.z + well.d / 2);
    expect(pad.z + pad.d / 2).toBeLessThan(HALF_D);
    expect(KEYBOARD_WIDTH).toBeGreaterThan(300);
    expect(KEYBOARD_DEPTH).toBeGreaterThan(90);
  });

  it('Anschlüsse: links HDMI, 2× TB4, microSD, Klinke; rechts 2× USB-A', () => {
    expect(readme).toMatch(/links HDMI 2\.1, 2× Thunderbolt 4.*microSD, 3,5-mm-Klinke/);
    expect(readme).toMatch(/rechts 2× USB-A/);
    const side = (s: string) => PORTS.filter((p) => p.side === s).map((p) => p.kind).sort();
    expect(side('left')).toEqual(['audio', 'hdmi', 'microsd', 'usbc', 'usbc']);
    expect(side('right')).toEqual(['usba', 'usba']);
    for (const c of contact) expect(PORTS.map((p) => p.name)).toContain(c.port);
  });

  it('Akku (4 Zellen) und SSD (M.2 2280) liegen nebeneinander', () => {
    expect(BATTERY.cells).toBe(4);
    expect([SSD.width, SSD.length]).toEqual([22, 80]);
    expect(SSD.x - SSD.width / 2).toBeGreaterThan(BATTERY_X_MAX);
    expect(SSD.x + SSD.width / 2).toBeLessThan(HALF_W - 2);
  });
});

describe('Tastenlayout', () => {
  const keys = keyLayout();

  it('Chiclet mit Numpad: 98 Tasten, keine Überlappung', () => {
    expect(keys).toHaveLength(98);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i]!;
        const b = keys[j]!;
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6;
        const overlapZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;
        expect(overlapX && overlapZ, `Taste ${i} überlappt ${j}`).toBe(false);
      }
    }
  });

  it('alle Tasten liegen in der Mulde', () => {
    const well = keyboardWell();
    for (const k of keys) {
      expect(k.x - k.w / 2).toBeGreaterThanOrEqual(well.x - well.w / 2);
      expect(k.x + k.w / 2).toBeLessThanOrEqual(well.x + well.w / 2);
      expect(k.z - k.d / 2).toBeGreaterThanOrEqual(well.z - well.d / 2);
      expect(k.z + k.d / 2).toBeLessThanOrEqual(well.z + well.d / 2);
    }
    expect(DECK.bottom + KEYBOARD.keyHeight).toBeLessThan(DECK.top);
  });
});

describe('buildLaptop', () => {
  const materials = createMaterials();
  const laptop = buildLaptop(parts, materials);

  it('liefert alle 8 keys aus parts.json als benannte Gruppen mit Geometrie', () => {
    expect(parts).toHaveLength(8);
    for (const { key } of parts) {
      const g = laptop.parts[key];
      expect(g, key).toBeDefined();
      expect(g!.name).toBe(key);
      expect(g!.parent).toBe(laptop.root);
      let verts = 0;
      g!.traverse((o) => {
        if (o instanceof Mesh) verts += o.geometry.getAttribute('position').count;
      });
      expect(verts, key).toBeGreaterThan(0);
    }
  });

  it('genau ein LineSegments je Teil', () => {
    for (const { key } of parts) {
      let lines = 0;
      laptop.parts[key]!.traverse((o) => {
        if (o instanceof LineSegments) lines++;
      });
      expect(lines, key).toBe(1);
    }
  });

  it('Tasten sind ein InstancedMesh', () => {
    const inst: InstancedMesh[] = [];
    laptop.parts['keyboard']!.traverse((o) => {
      if (o instanceof InstancedMesh) inst.push(o);
    });
    expect(inst).toHaveLength(1);
    expect(inst[0]!.count).toBe(98);
  });

  it('restPositions = Ausgangslage der Gruppen', () => {
    for (const { key } of parts) {
      expect(laptop.restPositions[key]!.equals(laptop.parts[key]!.position)).toBe(true);
      expect(laptop.restPositions[key]).not.toBe(laptop.parts[key]!.position);
    }
  });

  it('zugeklappt: Außenmaße 353,6 × 15,9 × 246,9 mm', () => {
    laptop.setLid(0);
    const b = boxMm(laptop.root);
    const size = b.getSize(new Vector3());
    // Anschlüsse stehen 0,15 mm vor, Kamera-Bucht/Scharniere liegen innerhalb
    expect(size.x).toBeGreaterThanOrEqual(BODY.width);
    expect(size.x).toBeLessThan(BODY.width + 0.5);
    expect(Math.abs(size.z - BODY.depth)).toBeLessThan(0.05);
    expect(b.min.y).toBeGreaterThan(-3); // Scharniere ragen leicht unter die Achse
    expect(b.max.y).toBeCloseTo(BODY.heightBack, 3);
  });

  it('Innenteile liegen in der Wanne zwischen Boden und Deck', () => {
    for (const key of ['board', 'battery', 'ssd', 'fans', 'ports']) {
      const b = boxMm(laptop.parts[key]!);
      expect(b.max.y, key).toBeLessThan(DECK.bottom - KEYBOARD.plate + 1e-6);
      expect(b.min.y, key).toBeGreaterThan(0);
      expect(b.min.z, key).toBeGreaterThan(-HALF_D);
      expect(b.max.z, key).toBeLessThan(HALF_D);
      if (key !== 'ports') {
        expect(b.min.x, key).toBeGreaterThan(-HALF_W);
        expect(b.max.x, key).toBeLessThan(HALF_W);
      }
    }
  });

  it('Akku vorne, Board hinten, Lüfter links und rechts', () => {
    const bat = boxMm(laptop.parts['battery']!);
    const board = boxMm(laptop.parts['board']!);
    const fans = boxMm(laptop.parts['fans']!);
    expect(bat.getCenter(new Vector3()).z).toBeGreaterThan(30);
    expect(board.getCenter(new Vector3()).z).toBeLessThan(0);
    expect(fans.min.x).toBeLessThan(-HALF_W + 30);
    expect(fans.max.x).toBeGreaterThan(HALF_W - 30);
  });

  it('setLid: 0 = zu, 1 = 110° offen, geklemmt; Display schaut offen nach vorne', () => {
    const pivot = laptop.lid.pivot;
    laptop.setLid(0);
    expect(pivot.rotation.x).toBe(-0);
    laptop.setLid(1);
    expect(pivot.rotation.x).toBeCloseTo((-LID_OPEN_DEG * Math.PI) / 180, 6);
    laptop.setLid(2);
    expect(pivot.rotation.x).toBeCloseTo((-LID_OPEN_DEG * Math.PI) / 180, 6);
    laptop.setLid(-1);
    expect(pivot.rotation.x).toBe(-0);

    laptop.setLid(1);
    laptop.root.updateMatrixWorld(true);
    const n = new Vector3(0, -1, 0).transformDirection(laptop.screenMesh.matrixWorld);
    expect(n.z).toBeGreaterThan(0.9);
    expect(n.y).toBeGreaterThan(0.2);
    // offen ragt der Deckel nach oben, bleibt aber hinter dem Unterteil
    const b = boxMm(laptop.parts['lid']!);
    expect(b.max.y).toBeGreaterThan(200);
    expect(b.max.z).toBeLessThan(-HALF_D + 2.5);
    laptop.setLid(0);
  });

  it('Anker: 8 Teile + 7 Anschlüsse, Anschlüsse auf der richtigen Seite', () => {
    for (const { key } of parts) expect(laptop.anchors[key], key).toBeInstanceOf(Vector3);
    for (const p of PORTS) {
      const a = laptop.anchors[p.name];
      expect(a, p.name).toBeInstanceOf(Vector3);
      if (p.side === 'left') expect(mm(a!.x)).toBeLessThan(-HALF_W);
      else expect(mm(a!.x)).toBeGreaterThan(HALF_W);
    }
    expect(Object.keys(laptop.anchors)).toHaveLength(15);
  });

  it('updateAnchors folgt der Explosion (gleiche Vector3-Objekte)', () => {
    const a = laptop.anchors['battery']!;
    const before = a.clone();
    laptop.parts['battery']!.position.y += 1.2;
    laptop.updateAnchors();
    expect(laptop.anchors['battery']).toBe(a);
    expect(a.y - before.y).toBeCloseTo(1.2, 6);
    laptop.parts['battery']!.position.copy(laptop.restPositions['battery']!);
    laptop.updateAnchors();
    expect(a.distanceTo(before)).toBeLessThan(1e-9);
  });

  it('Display: neutrale Fläche, Textur austauschbar', () => {
    const mat = laptop.screenMesh.material;
    const neutral = mat.color.getHex();
    expect(mat.map).toBeNull();
    const tex = new Texture();
    setScreenTexture(laptop.screenMesh, tex);
    expect(mat.map).toBe(tex);
    expect(mat.color.getHex()).toBe(0xffffff);
    setScreenTexture(laptop.screenMesh, null);
    expect(mat.map).toBeNull();
    expect(mat.color.getHex()).toBe(neutral);
  });

  it('Materialien werden geteilt und Draw-Calls bleiben wenige', () => {
    const used = new Set<unknown>();
    laptop.root.traverse((o) => {
      if (o instanceof Mesh || o instanceof LineSegments) used.add(o.material);
    });
    // case, paper, Display, Kanten auf Gehäuse, Kanten Tinte
    expect(used.size).toBeLessThanOrEqual(5);
    expect(countDrawCalls(laptop.root)).toBeLessThanOrEqual(20);
  });

  it('wirft bei unbekanntem key', () => {
    expect(() => buildLaptop([{ key: 'gpu' }], materials)).toThrow(/unbekannt/);
  });
});
