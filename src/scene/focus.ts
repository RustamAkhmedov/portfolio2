/*
 * Fokus/Ghost-Überblendung (docs/design.md, research.md R2): Das fokussierte Teil blendet mit `focusMix`
 * zu Orange (Fläche) und Tinte (Kanten), alle anderen Teile zu Ghost (Fläche weg, Kanten als dünne
 * Tintenlinien). Der Deckel bleibt unberührt (das Display bleibt Display, siehe Projekte).
 * Pro Teil und Ausgangsmaterial gibt es EINE Material-Kopie, angelegt beim Start; update() setzt nur Werte.
 */
import { Color, type Group, type LineBasicMaterial, type Material, type Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import type { Materials } from './materials';

/** Teile, die nie überblendet werden und selbst keinen Ghost auslösen. */
export const FOCUS_EXEMPT = ['lid'] as const;
/** Kantendeckkraft eines Ghost-Teils relativ zum Normalwert. */
export const GHOST_LINE_OPACITY = 0.55;
/** Unter dieser Flächen-Deckkraft wird die Fläche gar nicht gezeichnet. */
const FILL_HIDDEN_BELOW = 0.02;

export interface PartMix {
  /** 0…1 Richtung Fokus-Darstellung (Orange/Tinte) */
  focus: number;
  /** 0…1 Richtung Ghost (nur Linien) */
  ghost: number;
}

/** Mischfaktoren je Teil. Rein, ohne WebGL. */
export function partMix(key: string, focus: string | null, focusMix: number): PartMix {
  const m = Math.min(1, Math.max(0, focusMix));
  const exempt = FOCUS_EXEMPT as readonly string[];
  if (focus === null || m === 0 || exempt.includes(key) || exempt.includes(focus)) return { focus: 0, ghost: 0 };
  return key === focus ? { focus: m, ghost: 0 } : { focus: 0, ghost: m };
}

export interface FocusController {
  update(s: { focus: string | null; focusMix: number }): void;
}

interface Fill {
  mesh: Mesh;
  mat: MeshLambertMaterial;
  base: Color;
}
interface Line {
  obj: Object3D;
  mat: LineBasicMaterial;
  base: Color;
  baseOpacity: number;
  baseTransparent: boolean;
}
interface PartRig {
  fills: Fill[];
  lines: Line[];
  last: PartMix;
}

export function createFocusController(parts: Record<string, Group>, materials: Materials): FocusController {
  const orange = materials.focus.color.clone();
  const ink = materials.edgeInk.color.clone();
  const rigs = new Map<string, PartRig>();

  for (const [key, group] of Object.entries(parts)) {
    if ((FOCUS_EXEMPT as readonly string[]).includes(key)) continue;
    const clones = new Map<Material, Material>();
    const clone = <T extends Material>(m: T): T => {
      let c = clones.get(m);
      if (!c) clones.set(m, (c = m.clone()));
      return c as T;
    };
    const rig: PartRig = { fills: [], lines: [], last: { focus: 0, ghost: 0 } };
    group.traverse((o) => {
      const r = o as Object3D & { isMesh?: boolean; isLine?: boolean; material?: Material };
      if (r.isMesh && r.material) {
        const mesh = o as Mesh;
        const mat = clone(mesh.material as MeshLambertMaterial);
        mesh.material = mat;
        rig.fills.push({ mesh, mat, base: mat.color.clone() });
      } else if (r.isLine && r.material) {
        const mat = clone(r.material as LineBasicMaterial);
        (o as unknown as { material: Material }).material = mat;
        o.renderOrder = 1;
        rig.lines.push({ obj: o, mat, base: mat.color.clone(), baseOpacity: mat.opacity, baseTransparent: mat.transparent });
      }
    });
    rigs.set(key, rig);
  }

  function apply(rig: PartRig, mix: PartMix): void {
    for (const f of rig.fills) {
      f.mat.color.lerpColors(f.base, orange, mix.focus);
      const opacity = 1 - mix.ghost;
      f.mat.opacity = opacity;
      f.mat.transparent = opacity < 1;
      f.mat.depthWrite = opacity >= 1;
      f.mat.visible = opacity > FILL_HIDDEN_BELOW; // nicht mesh.visible: die Kanten hängen als Kinder daran
    }
    const toInk = Math.max(mix.focus, mix.ghost);
    for (const l of rig.lines) {
      l.mat.color.lerpColors(l.base, ink, toInk);
      l.mat.opacity = l.baseOpacity * (1 - (1 - GHOST_LINE_OPACITY) * mix.ghost);
      l.mat.transparent = l.baseTransparent || mix.ghost > 0;
    }
  }

  return {
    update(s) {
      for (const [key, rig] of rigs) {
        const mix = partMix(key, s.focus, s.focusMix);
        if (mix.focus === rig.last.focus && mix.ghost === rig.last.ghost) continue;
        rig.last = mix;
        apply(rig, mix);
      }
    },
  };
}
