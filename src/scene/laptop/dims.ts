/*
 * Maße des stilisierten Laptops in Millimetern (docs/referenz/laptop/README.md, Fotos 01–08).
 * Szeneneinheit: 1 = 100 mm (MM). Alle Teile werden in mm gebaut und erst am Teil-Inhalt skaliert.
 *
 * Koordinaten (im zusammengebauten Gerät, Deckel zu):
 *   x = Breite (rechts +), y = Höhe (oben +), z = Tiefe (vorne +, zur Kamera).
 *   Ursprung: Mitte der Grundfläche; y = 0 ist die Unterkante hinten.
 *   Keil: Die Oberseite des Tastaturdecks ist waagrecht, die Unterseite steigt nach vorne um WEDGE_RISE an
 *   (Seitenfotos 06/07: Oberkante gerade, Unterkante schräg).
 */

/** Szeneneinheiten je Millimeter. */
export const MM = 0.01;

/** Außenmaße laut ASUS-Techspec. */
export const BODY = {
  width: 353.6,
  depth: 246.9,
  heightFront: 13.9,
  heightBack: 15.9,
  /** Eckenradius im Grundriss (Foto 08, ~30 px von 1510 px Breite). */
  cornerRadius: 7,
} as const;

export const HALF_W = BODY.width / 2;
export const HALF_D = BODY.depth / 2;

/** Deckel (Display-Hälfte), konstante Dicke (Foto 07: ~30 % der Gesamthöhe). */
export const LID_THICKNESS = 5.0;
/** Öffnungswinkel bei setLid(1). */
export const LID_OPEN_DEG = 110;

/** Unterteil: hinten 10,9 mm, vorne 8,9 mm (Gesamthöhe minus Deckel). */
export const BASE_HEIGHT_BACK = BODY.heightBack - LID_THICKNESS;
export const BASE_HEIGHT_FRONT = BODY.heightFront - LID_THICKNESS;
export const WEDGE_RISE = BASE_HEIGHT_BACK - BASE_HEIGHT_FRONT;

/** Wanne (Bodenplatte `bottom`): Wand- und Bodenstärke. */
export const SHELL = { wall: 1.5, floor: 1.0 } as const;

/** Tastaturdeck (`keyboard`): Oberseite waagrecht auf Höhe des Unterteils hinten. */
export const DECK = {
  top: BASE_HEIGHT_BACK,
  thickness: 1.2,
  bottom: BASE_HEIGHT_BACK - 1.2,
} as const;

/** Unterkante der Wanne an der Tiefe z (Keil): 0 hinten … WEDGE_RISE vorne. */
export function bottomY(z: number): number {
  const t = Math.min(1, Math.max(0, (z + HALF_D) / BODY.depth));
  return WEDGE_RISE * t;
}

/** Oberseite des Wannenbodens an der Tiefe z (darauf liegen die Innenteile). */
export function floorTopY(z: number): number {
  return bottomY(z) + SHELL.floor;
}

// ---------------------------------------------------------------------------------------------
// Display

const DIAG_MM = 15.6 * 25.4;
const ASPECT_W = 16;
const ASPECT_H = 9;
const ASPECT_DIAG = Math.hypot(ASPECT_W, ASPECT_H);

export const DISPLAY = {
  diagonalIn: 15.6,
  /** aktive Fläche 16:9 */
  width: (DIAG_MM * ASPECT_W) / ASPECT_DIAG,
  height: (DIAG_MM * ASPECT_H) / ASPECT_DIAG,
  /** Rahmen oben bis zur aktiven Fläche (Foto 01: ~26 px von 1110 px Deckelbreite). */
  topBezel: 8,
} as const;

/** Kamera-Bucht im oberen Rahmen (Foto 01: dunkle Leiste mittig, ~75 mm breit). */
export const CAMERA_BAY = { width: 64, depth: 4.6, fromTop: 4.0, raise: 0.25, lensRadius: 1.3 } as const;

/** Scharniere (Foto 03: Blöcke ~27 mm von den Seiten). */
export const HINGE = { x: HALF_W - 27.5, radius: 2.8, length: 24 } as const;

// ---------------------------------------------------------------------------------------------
// Tastatur (Foto 03, Maßstab 0,2987 mm/px): Chiclet, Hauptblock 15 u + schmaler Numpad (3 Spalten)

export const KEYBOARD = {
  /** Rastermaß im Hauptblock */
  pitch: 18.0,
  /** Spalt zwischen Tasten */
  gap: 2.8,
  /** Zeilenabstand der Reihen 1–5 */
  rowPitch: 18.2,
  keyDepth: 15.4,
  /** Funktionsreihe ist niedriger */
  fnDepth: 9.0,
  /** Abstand Oberkante Fn-Reihe → Oberkante Zahlenreihe */
  fnOffset: 11.6,
  /** Oberkante Fn-Reihe ab Hinterkante */
  fromBack: 21,
  /** Numpad-Spalten (schmal) */
  numPitch: 15.6,
  numCols: 3,
  /** Abstand Hauptblock → Numpad (zusätzlich zum Tastenspalt) */
  numGap: 1.0,
  /** Tastenhöhe über dem Mulden-Boden; Oberkante liegt 0,1 mm unter dem Deck (Deckel schließt). */
  keyHeight: 1.1,
  /** Rand der Tastaturmulde um die Tasten */
  wellMargin: 2.5,
  /** Stärke der Tastatur-Trägerplatte unter der Mulde */
  plate: 0.5,
} as const;

export const KEYBOARD_WIDTH = 15 * KEYBOARD.pitch + KEYBOARD.numGap + KEYBOARD.numCols * KEYBOARD.numPitch;
/** Tiefe über alle Reihen (Oberkante Fn bis Unterkante Reihe 5) */
export const KEYBOARD_DEPTH = KEYBOARD.fnOffset + 4 * KEYBOARD.rowPitch + KEYBOARD.keyDepth;

/** Touchpad 150 × 99 mm ≈ 7,1″ Diagonale, mittig unter dem Hauptblock (Foto 03). */
export const TOUCHPAD = {
  width: 150,
  depth: 99,
  centerX: -KEYBOARD_WIDTH / 2 + (15 * KEYBOARD.pitch) / 2,
  fromFront: 9.6,
  /** Spalt zum Deck */
  gap: 0.4,
  thickness: 1.0,
} as const;

// ---------------------------------------------------------------------------------------------
// Innenleben (stilisiert, README: Akku vorne über die Breite, Mainboard hinten mittig,
// links/rechts je ein Lüfter, SSD neben dem Akku)

/** Lüfter: Mittelpunkte bei x = ±centerX, z = centerZ. */
export const FANS = {
  radius: 31,
  inletRadius: 20,
  centerX: HALF_W - 45,
  centerZ: -HALF_D + 45.5,
  bottom: 2.0,
  height: 6.0,
  blades: 15,
  hubRadius: 9,
  /** Halbe Breite des Auslasses zum Kühler */
  outletHalf: 26,
  /** Kühlerlamellen hinten an der Wand */
  finZBack: -HALF_D + SHELL.wall + 0.5,
  finZFront: -HALF_D + 12.5,
  finTop: 6.2,
  /** Heatpipes (flach) liegen auf Kühlplatte und Lamellen */
  pipeWidth: 7,
  pipeThickness: 2,
} as const;

/** Mainboard: Rechteck hinten mittig + Lasche vorne rechts für den M.2-Steckplatz. */
export const BOARD = {
  xMin: -95,
  xMax: 95,
  zBack: -112,
  zFront: 24,
  tab: { xMin: 95, xMax: 128, zBack: 0, zFront: 30 },
  bottom: 3.0,
  thickness: 0.9,
  cpu: { x: 0, z: -60, width: 44, depth: 26, substrate: 0.7, die: 0.6 },
  ram: { z: -28, xs: [-27, -9, 9, 27], width: 14, depth: 12, height: 1.0 },
} as const;
export const BOARD_TOP = BOARD.bottom + BOARD.thickness;
export const CPU_TOP = BOARD_TOP + BOARD.cpu.substrate + BOARD.cpu.die;
/** Kühlplatte auf der CPU (gehört zum Kühlmodul `fans`). */
export const COLD_PLATE = { width: 34, depth: 28, thickness: 1.0 } as const;

/** Akku 75 Wh, 4 Zellen (4S1P), vorne. */
export const BATTERY = {
  cells: 4,
  cellWidth: 62,
  cellDepth: 76,
  cellHeight: 5.4,
  cellGap: 2,
  xMin: -163,
  /** Vorderkante der Zellen */
  zFront: HALF_D - 13.5,
  tray: 0.5,
  /** Oberkante Wannenboden vorne + Luft */
  bottom: SHELL.floor + WEDGE_RISE + 0.05,
  bmsDepth: 5,
} as const;
export const BATTERY_X_MAX =
  BATTERY.xMin + BATTERY.cells * BATTERY.cellWidth + (BATTERY.cells - 1) * BATTERY.cellGap;

/** SSD M.2 2280 (22 × 80 mm) rechts neben dem Akku, Stecker an der Board-Lasche. */
export const SSD = {
  width: 22,
  length: 80,
  thickness: 0.8,
  x: (BOARD.tab.xMin + BOARD.tab.xMax) / 2,
  /** Hinterkante (Steckerseite) */
  zBack: 25.5,
  /** Höhe der Platine (im Steckplatz) */
  bottom: BOARD_TOP + 1.1,
} as const;

// ---------------------------------------------------------------------------------------------
// Anschlüsse (Fotos 06/07, Maßstab 0,170 mm/px; Abstand Mitte ab Hinterkante)

export type PortKind = 'hdmi' | 'usbc' | 'usba' | 'microsd' | 'audio';
export type PortName = 'HDMI' | 'TB4-1' | 'TB4-2' | 'microSD' | 'Audio' | 'USB-A-1' | 'USB-A-2';

export interface PortDef {
  name: PortName;
  side: 'left' | 'right';
  kind: PortKind;
  /** Mitte ab Hinterkante in mm */
  fromBack: number;
}

/** Nummerierung jeweils von hinten nach vorne. */
export const PORTS: readonly PortDef[] = [
  { name: 'HDMI', side: 'left', kind: 'hdmi', fromBack: 34.6 },
  { name: 'TB4-1', side: 'left', kind: 'usbc', fromBack: 55.3 },
  { name: 'TB4-2', side: 'left', kind: 'usbc', fromBack: 69.8 },
  { name: 'microSD', side: 'left', kind: 'microsd', fromBack: 90.6 },
  { name: 'Audio', side: 'left', kind: 'audio', fromBack: 106.8 },
  { name: 'USB-A-1', side: 'right', kind: 'usba', fromBack: 30.6 },
  { name: 'USB-A-2', side: 'right', kind: 'usba', fromBack: 51.4 },
];

/** Öffnungen (außen/innen) und Einbautiefe je Anschlusstyp, mm. */
export const PORT_SHAPES: Record<PortKind, { outerW: number; outerH: number; innerW: number; innerH: number; depth: number }> = {
  hdmi: { outerW: 15.2, outerH: 5.8, innerW: 14.0, innerH: 4.6, depth: 10 },
  usbc: { outerW: 9.0, outerH: 3.4, innerW: 8.3, innerH: 2.6, depth: 8 },
  usba: { outerW: 13.2, outerH: 5.6, innerW: 12.4, innerH: 4.8, depth: 10 },
  microsd: { outerW: 12.0, outerH: 2.0, innerW: 11.2, innerH: 1.1, depth: 10 },
  audio: { outerW: 6.0, outerH: 6.0, innerW: 3.5, innerH: 3.5, depth: 9 },
};

/** Abstand der Anschluss-Stirnfläche vor der Seitenwand (gegen Z-Fighting). */
export const PORT_PROUD = 0.15;

/** Mittelhöhe der Anschlüsse an der Tiefe z (Mitte zwischen Unterkante und Deck). */
export function portCenterY(z: number): number {
  return (bottomY(z) + DECK.top) / 2 - 0.4;
}

/** z eines Anschlusses aus seinem Abstand zur Hinterkante. */
export function portZ(p: PortDef): number {
  return -HALF_D + p.fromBack;
}
