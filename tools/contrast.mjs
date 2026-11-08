// WCAG-Kontraste der Design-Tokens (docs/messungen.md, Abschnitt „Kontraste“). Aufruf: node tools/contrast.mjs
// Liest die Farben aus src/styles/tokens.css, rechnet nach WCAG 2.x (relative Luminanz, sRGB).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/styles/tokens.css'), 'utf8');
const tok = {};
for (const m of css.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) tok[m[1]] = m[2];

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** a mit Deckkraft alpha über b */
const mix = (a, b, alpha) => '#' + rgb(a).map((c, i) => Math.round(c * alpha + rgb(b)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');

// [Beschreibung, Vordergrund, Hintergrund, Minimum]
const pairs = [
  ['Text --ink auf --paper', 'ink', 'paper', 4.5],
  ['Text --ink auf --paper-hi', 'ink', 'paper-hi', 4.5],
  ['Text --orange-ink auf --paper (Hover, Fokus)', 'orange-ink', 'paper', 4.5],
  ['Text --orange-ink auf --paper-hi', 'orange-ink', 'paper-hi', 4.5],
  ['Fokusring --orange-ink auf --paper (UI, 3:1)', 'orange-ink', 'paper', 3],
  ['Fokusring --orange-ink auf --paper-hi (UI, 3:1)', 'orange-ink', 'paper-hi', 3],
  ['Fokusring --orange-ink auf --case (dunkler Laptop, UI, 3:1)', 'orange-ink', 'case', 3],
  ['Fokusring --orange auf --case (dunkler Laptop, UI, 3:1)', 'orange', 'case', 3],
  ['Label-Nummer --ink auf --orange (aktiv)', 'ink', 'orange', 4.5],
  ['Linie --ink auf --paper (UI, 3:1)', 'ink', 'paper', 3],
  ['Label-Linie --ink auf --case (UI, 3:1)', 'ink', 'case', 3],
  ['Label-Linie --paper-hi auf --case (UI, 3:1)', 'paper-hi', 'case', 3],
  ['Label-Linie --case-edge auf --case (UI, 3:1)', 'case-edge', 'case', 3],
  ['--grid auf --paper (nur Trennlinien, nicht für Text)', 'grid', 'paper', 3],
  ['--grid auf --paper (als Text, zur Warnung)', 'grid', 'paper', 4.5],
  ['Text --paper-hi auf --case', 'paper-hi', 'case', 4.5],
];
const out = [];
let bad = 0;
for (const [name, f, b, min] of pairs) {
  const r = ratio(tok[f], tok[b]);
  out.push({name, fg: tok[f], bg: tok[b], ratio: r, min, ok: r >= min});
}
// Stücklistenzeile während der Einblendung (opacity) – nur Übergang, Endzustand deckend
for (const a of [0.5, 0.75, 1]) out.push({name: `Zeilentext --ink bei Deckkraft ${a} auf --paper`, fg: mix(tok.ink, tok.paper, a), bg: tok.paper, ratio: ratio(mix(tok.ink, tok.paper, a), tok.paper), min: 4.5, ok: ratio(mix(tok.ink, tok.paper, a), tok.paper) >= 4.5});
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else for (const o of out) console.log(`${o.ok ? 'ok  ' : 'FAIL'} ${o.ratio.toFixed(2).padStart(5)}:1 (min ${o.min})  ${o.name}  ${o.fg} / ${o.bg}`);
