/*
 * Display-Inhalt (T031): Projekt-Screenshots als Texturen auf der Display-Fläche, überblendet über `state.screen`.
 *
 * Reihenfolge = Reihenfolge der Projekte: erst die featured (Index 0–5), dann die übrigen in Dateireihenfolge.
 * `state.screen` ist ein stetiger Index; floor/ceil werden mit dem Anteil frac gemischt (ein Mesh, ein Draw-Call:
 * zwei Texturen + `mix` im Fragment-Shader des vorhandenen MeshBasicMaterial). -1 = kein Projekt (neutrale Fläche
 * in Tinten-Ton); zwischen -1 und 0 wird zum ersten Projekt geblendet.
 * Texturen laden lazy (erst ab explode > 0 oder sobald screen >= 0), je Projekt bei Bedarf plus die zwei Nachbarn;
 * weit entfernte werden wieder freigegeben. Fehlt ein Bild: Ink-Fläche mit Projektname (Canvas, --font-mono/--paper).
 * Die Szene kennt sonst keine Texte; hier kommen nur Name + thumb aus projects.json.
 */
import {
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  type WebGLRenderer,
} from 'three';
import projectsData from '../content/projects.json';
import { DISPLAY } from './laptop/dims';
import { setScreenTexture } from './laptop/lid';
import type { Laptop } from './laptop';
import type { SceneState } from './state';

// ---------- reine Funktionen (ohne WebGL testbar) ----------

interface ProjectEntry {
  name: string;
  thumb?: string;
  featured?: boolean;
}

const all = projectsData as unknown as ProjectEntry[];

/** Projekte in Display-Reihenfolge: featured zuerst, dann der Rest in Dateireihenfolge. */
export const SCREEN_PROJECTS: readonly { name: string; thumb: string | null }[] = [
  ...all.filter((p) => p.featured),
  ...all.filter((p) => !p.featured),
].map((p) => ({ name: p.name, thumb: p.thumb ?? null }));

export const SCREEN_COUNT = SCREEN_PROJECTS.length;

/** Display-Index zu einem Projektnamen; -1, wenn unbekannt. */
export function screenIndexOf(name: string): number {
  return SCREEN_PROJECTS.findIndex((p) => p.name === name);
}

export interface ScreenBlend {
  /** Index unten / oben; -1 = neutrale Fläche */
  a: number;
  b: number;
  /** Anteil von b (0 … 1) */
  t: number;
}

/** Zerlegt den stetigen Index in zwei Folien und den Mischanteil. */
export function screenBlend(screen: number, count: number = SCREEN_COUNT): ScreenBlend {
  if (!Number.isFinite(screen) || screen <= -1 || count <= 0) return { a: -1, b: -1, t: 0 };
  const s = Math.min(screen, count - 1);
  const a = Math.floor(s);
  const t = s - a;
  if (t < 1e-4) return { a, b: a, t: 0 };
  return { a, b: Math.min(a + 1, count - 1), t };
}

/** Indizes, die geladen sein sollen: die gezeigten plus je ein Nachbar. Bei screen < 0 nur die ersten zwei. */
export function neededIndices(screen: number, count: number = SCREEN_COUNT): number[] {
  if (count <= 0) return [];
  const { a, b } = screenBlend(screen, count);
  const lo = Math.max(0, a);
  const hi = Math.max(0, b);
  const out: number[] = [];
  for (let i = Math.max(0, lo - 1); i <= Math.min(count - 1, hi + 1); i++) out.push(i);
  if (a < 0) out.push(...[0, 1].filter((i) => i < count && !out.includes(i)));
  return out;
}

/** Skalierung der Einpassung (`contain`) eines Bildes auf die Display-Fläche; (1,1) = füllt. */
export function fitScale(imageAspect: number, displayAspect: number): [number, number] {
  if (!(imageAspect > 0) || !(displayAspect > 0)) return [1, 1];
  return imageAspect > displayAspect ? [1, displayAspect / imageAspect] : [imageAspect / displayAspect, 1];
}

const DISPLAY_ASPECT = DISPLAY.width / DISPLAY.height;
const MAX_WIDTH = 1280;
/** Index-Abstand, ab dem eine geladene Textur wieder freigegeben wird. */
const KEEP_RADIUS = 2;

// ---------- WebGL ----------

const FALLBACK = { '--paper': '#E7E3D8', '--ink': '#1B2230', '--font-mono': 'ui-monospace, monospace' } as const;

function token(name: keyof typeof FALLBACK): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name];
}

function thumbUrl(thumb: string): string {
  // Build: Chunk liegt in assets/, Bilder in img/ (gilt für / und /en/); Dev: Wurzel.
  return import.meta.env.DEV ? '/' + thumb : new URL('../' + thumb, import.meta.url).href;
}

function tag(tex: Texture, fit: [number, number], maxAniso: number): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = maxAniso;
  tex.userData['fit'] = fit;
  return tex;
}

function solidTexture(ink: string, maxAniso: number): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, 4, 4);
  }
  const t = tag(new CanvasTexture(c), [1, 1], maxAniso);
  t.generateMipmaps = false;
  t.minFilter = t.magFilter;
  return t;
}

async function nameTexture(name: string, maxAniso: number): Promise<Texture> {
  const mono = token('--font-mono');
  try {
    await document.fonts?.load(`600 40px ${mono}`);
  } catch {
    /* Schrift nicht verfügbar: Fallback der Familie */
  }
  const w = 1024;
  const h = Math.round(w / DISPLAY_ASPECT);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = token('--ink');
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = token('--paper');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 56;
    ctx.font = `600 ${size}px ${mono}`;
    while (size > 18 && ctx.measureText(name).width > w * 0.84) {
      size -= 2;
      ctx.font = `600 ${size}px ${mono}`;
    }
    ctx.fillText(name, w / 2, h / 2);
  }
  return tag(new CanvasTexture(c), [1, 1], maxAniso);
}

async function imageTexture(url: string, maxAniso: number): Promise<Texture> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  let bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
  if (bmp.width > MAX_WIDTH) {
    const small = await createImageBitmap(bmp, {
      resizeWidth: MAX_WIDTH,
      resizeHeight: Math.round((bmp.height * MAX_WIDTH) / bmp.width),
      resizeQuality: 'high',
    });
    bmp.close();
    bmp = small;
  }
  const tex = tag(new Texture(bmp), fitScale(bmp.width / bmp.height, DISPLAY_ASPECT), maxAniso);
  tex.flipY = false; // schon beim Dekodieren gespiegelt
  tex.needsUpdate = true;
  // Bitmap nach dem Hochladen freigeben (Speicher); die GPU hält die Pixel.
  tex.onUpdate = () => {
    bmp.close();
    tex.onUpdate = null;
  };
  return tex;
}

export interface ScreenController {
  /** Aktualisiert Texturwahl und Überblendung aus dem State (bei jeder Änderung aufrufen). */
  update(s: Readonly<Pick<SceneState, 'screen' | 'explode'>>): void;
  dispose(): void;
}

/**
 * Hängt die Überblendung an die Display-Fläche des Laptops.
 * @param invalidate fordert nach asynchron geladenen Texturen ein Neuzeichnen an
 */
export function createScreen(
  renderer: Pick<WebGLRenderer, 'capabilities'> & Partial<Pick<WebGLRenderer, 'initTexture'>>,
  laptop: Pick<Laptop, 'screenMesh'>,
  invalidate: () => void,
): ScreenController {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ink = token('--ink');
  const neutral = solidTexture(ink, aniso);
  const mesh = laptop.screenMesh;
  const mat = mesh.material;
  const uniforms = {
    mapB: { value: neutral as Texture },
    uT: { value: 0 },
    uFitA: { value: [1, 1] as [number, number] },
    uFitB: { value: [1, 1] as [number, number] },
    uBg: { value: new Color(ink) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>
        uniform sampler2D mapB;
        uniform float uT;
        uniform vec2 uFitA;
        uniform vec2 uFitB;
        uniform vec3 uBg;
        vec4 fitSample(sampler2D tex, vec2 uv, vec2 fit) {
          vec2 p = (uv - 0.5) / fit + 0.5;
          if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(uBg, 1.0);
          return texture2D(tex, p);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = mix(fitSample(map, vMapUv, uFitA), fitSample(mapB, vMapUv, uFitB), uT);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'screen-blend';

  const cache = new Map<number, Texture>();
  const loading = new Set<number>();
  let last: Pick<SceneState, 'screen' | 'explode'> = { screen: -1, explode: 0 };
  let disposed = false;

  const textureFor = (i: number): Texture => cache.get(i) ?? neutral;

  const load = (i: number): void => {
    if (cache.has(i) || loading.has(i)) return;
    const p = SCREEN_PROJECTS[i];
    if (!p) return;
    loading.add(i);
    const done = (tex: Texture): void => {
      loading.delete(i);
      if (disposed) return tex.dispose();
      // Gleich hochladen (eigener Task), nicht erst im nächsten Render-Frame (T034: sonst ein langer Frame
      // beim ersten Zeigen eines Projekts).
      renderer.initTexture?.(tex);
      cache.set(i, tex);
      apply();
      invalidate();
    };
    const fallback = (): void => void nameTexture(p.name, aniso).then(done);
    if (!p.thumb) return fallback();
    imageTexture(thumbUrl(p.thumb), aniso).then(done, fallback);
  };

  const apply = (): void => {
    const { a, b, t } = screenBlend(last.screen);
    const ta = a < 0 ? neutral : textureFor(a);
    const tb = b < 0 ? neutral : textureFor(b);
    setScreenTexture(mesh, ta);
    uniforms.mapB.value = tb;
    uniforms.uT.value = t;
    uniforms.uFitA.value = (ta.userData['fit'] as [number, number]) ?? [1, 1];
    uniforms.uFitB.value = (tb.userData['fit'] as [number, number]) ?? [1, 1];
  };

  return {
    update(s) {
      last = s;
      if (s.explode > 0 || s.screen >= 0) {
        const need = neededIndices(s.screen);
        need.forEach(load);
        const centre = Math.max(0, Math.round(s.screen));
        for (const [i, tex] of cache) {
          if (Math.abs(i - centre) > KEEP_RADIUS) {
            tex.dispose();
            cache.delete(i);
          }
        }
      }
      apply();
    },
    dispose() {
      disposed = true;
      cache.forEach((t) => t.dispose());
      cache.clear();
      neutral.dispose();
    },
  };
}
