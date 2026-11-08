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
import { onChange, state } from './state';

export { setState, state } from './state';

export interface SceneHandle {
  rig: SceneRig;
}

export function startScene(container: HTMLElement): SceneHandle {
  const parts = partsData as unknown as ApplyPart[];
  const rig = createRenderer(container);
  const laptop = buildLaptop(parts, createMaterials());
  rig.scene.add(laptop.root);

  const sync = (): void => {
    applyState(laptop, parts, state);
    rig.applyCamera(cameraAt(state.cam));
  };
  sync();
  onChange(sync);
  rig.start();
  return { rig };
}
