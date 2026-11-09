/*
 * Szene: Renderer + Laptop + Anbindung an den State. Wird von main.ts dynamisch importiert.
 * Die Choreografie (Phase 6) schreibt nur in den State; hier wird er gelesen und gezeichnet.
 */
import partsData from '../content/parts.json';
import { applyState, type ApplyPart } from './apply';
import { blendPose, cameraAt, demoPose } from './camera-path';
import { createDemoFrame, type DemoFrame } from './demo-frame';
import { createFocusController } from './focus';
import { buildLaptop } from './laptop';
import { createMaterials } from './materials';
import { createRenderer, type SceneRig } from './renderer';
import { createLabels, type Labels } from './labels';
import { createScreen } from './screen';
import { onChange, requestRender, state } from './state';

export { setState, state } from './state';
export type { Labels } from './labels';
export type { DemoFrame } from './demo-frame';
export { SCREEN_COUNT, screenIndexOf } from './screen';

export interface SceneHandle {
  rig: SceneRig;
  /** null, wenn #labels fehlt */
  labels: Labels | null;
  /** Live-Demo (T081): Element über das Display legen (attach) */
  demo: Pick<DemoFrame, 'attach'>;
}

export function startScene(container: HTMLElement): SceneHandle {
  const parts = partsData as unknown as ApplyPart[];
  const rig = createRenderer(container);
  const materials = createMaterials();
  const laptop = buildLaptop(parts, materials);
  const focus = createFocusController(laptop.parts, materials);
  rig.scene.add(laptop.root);

  const screen = createScreen(rig.renderer, laptop, requestRender);
  const demo = createDemoFrame({ camera: rig.camera, screen: laptop.screenMesh, viewport: rig.viewport });
  /** Kamera: Scroll-Keyframe, mit state.demoMix > 0 gemischt mit dem Keyframe `demo` (Bezugsrahmen: ganzes Fenster) */
  const camera = (): void => {
    const base = cameraAt(state.cam, state.compact);
    const t = state.demoMix;
    if (t <= 0) return rig.applyCamera(base);
    const vp = rig.viewport();
    const target = demoPose(demo.displayFrame(), demo.rect(), vp.width, vp.height);
    rig.applyCamera({ ...blendPose(base, target, t), frame: t });
  };
  const sync = (): void => {
    applyState(laptop, parts, state);
    focus.update(state);
    screen.update(state);
    camera();
  };
  sync();
  onChange(sync);
  // Pose `demo` hängt von der Fenstergröße ab
  rig.onResize(() => {
    if (state.demoMix > 0) camera();
  });
  rig.onFrame(() => demo.update());
  // Labels ziehen nach jedem gezeichneten Frame nach (jede State-Änderung fordert einen Frame an).
  const overlay = document.getElementById('labels');
  const labels = overlay
    ? createLabels(overlay, { camera: rig.camera, laptop, parts: parts as unknown as { id: string; key: string }[] })
    : null;
  if (labels) rig.onFrame(() => labels.update());
  rig.start();
  return { rig, labels, demo };
}
