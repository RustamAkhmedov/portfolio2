/*
 * Szene: Renderer + Laptop + Anbindung an den State. Wird von main.ts dynamisch importiert.
 * Die Choreografie (Phase 6) schreibt nur in den State; hier wird er gelesen und gezeichnet.
 */
import partsData from '../content/parts.json';
import { applyState, type ApplyPart } from './apply';
import { cameraAt } from './camera-path';
import { buildLaptop } from './laptop';
import { createMaterials } from './materials';
import { createRenderer, type SceneRig } from './renderer';
import { createLabels, type Labels } from './labels';
import { createScreen } from './screen';
import { onChange, requestRender, state } from './state';

export { setState, state } from './state';
export type { Labels } from './labels';
export { SCREEN_COUNT, screenIndexOf } from './screen';

export interface SceneHandle {
  rig: SceneRig;
  /** null, wenn #labels fehlt */
  labels: Labels | null;
}

export function startScene(container: HTMLElement): SceneHandle {
  const parts = partsData as unknown as ApplyPart[];
  const rig = createRenderer(container);
  const laptop = buildLaptop(parts, createMaterials());
  rig.scene.add(laptop.root);

  const screen = createScreen(rig.renderer, laptop, requestRender);
  const sync = (): void => {
    applyState(laptop, parts, state);
    screen.update(state);
    rig.applyCamera(cameraAt(state.cam));
  };
  sync();
  onChange(sync);
  // Labels ziehen nach jedem gezeichneten Frame nach (jede State-Änderung fordert einen Frame an).
  const overlay = document.getElementById('labels');
  const labels = overlay
    ? createLabels(overlay, { camera: rig.camera, laptop, parts: parts as unknown as { id: string; key: string }[] })
    : null;
  if (labels) rig.onFrame(() => labels.update());
  rig.start();
  return { rig, labels };
}
