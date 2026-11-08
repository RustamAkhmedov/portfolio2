# Messungen

Messwerte zu Constitution III („Leicht für die iGPU“) und den Erfolgskriterien der Spec. Jede Messung mit
Datum, Methode und Grenzen. T071 ergänzt später die Ladezeiten (LCP, bedienbar).

## Szene-FPS, Draw-Calls, Bundle (T034, 2026-11-08)

### Ergebnis kurz

- **Ziel erreicht, ohne Eingriff in Geometrie, DPR oder Antialiasing.** Im normalen Firefox-Fenster auf dem
  Laptop (120-Hz-Panel) läuft die Szene beim Durchscrollen mit **~117–120 fps**, das schlechteste
  500-ms-Fenster liegt bei **≥ 110 fps** (Spec: nie unter 45 fps länger als 0,5 s; Quickstart 10: ≥ 55 fps).
- Pro Frame: **18 Draw-Calls, 12 394 Dreiecke, 7 657 Linien, 5 Programmwechsel**, in jeder Station gleich.
  Render-Aufruf + Labels **0,3–0,7 ms CPU**, GPU-Wartezeit (gl.finish) **≤ 2 ms** bei Canvas 1924×1440.
- **Ruhe = 0 Render-Calls**: vor und nach dem Scrollen in 2 s jeweils 0 von 120 (60 Hz) bzw. 0 von ~238
  (120 Hz) Frames gezeichnet.
- **JavaScript der Startseite: 219 KB gzip** (Grenze 350 KB).
- Zwei Dinge geändert: die Anzeige `__v2.fps()` (zeigte beim Durchscrollen falsche 15–30 fps, siehe unten)
  und das Hochladen der Projekt-Texturen (vorher ein Frame mit 8–12 ms beim ersten Zeigen eines Projekts).

### Methode

Werkzeug: `npm run perf` (`tools/perf.mjs`), nur Firefox 159 über WebDriver BiDi (`tools/ffbrowser.mjs`).

- Ein Preload-Skript hängt sich vor allen Seiten-Skripten an `requestAnimationFrame` und den
  WebGL-Prototyp. Dadurch geht es auch im Produktions-Build ohne Test-Hook. Je Browser-Frame zählt es:
  Bildabstand, ob gezeichnet wurde, Draw-Calls, Dreiecke und Linien (wie `renderer.info`), `useProgram`,
  JS-Zeit aller rAF-Callbacks (aufgeteilt in den Render-Callback = `render` + `labels.update` und den Rest =
  GSAP/Lenis/ScrollTrigger + `applyState`/`screen.update`), Zeit für Textur-Uploads, Shader-Linken und
  erzwungenes Layout. Den Texturspeicher schätzt es aus `texStorage2D`/`texImage2D` (RGBA8, Mipmaps +⅓).
- Durchscrollen: Hero bis Verzeichnis (`#projekte-alle` + 0,6 Viewport) in 12 s. Standard ist eine
  Scroll-Position pro Frame (`scrollTo`, rAF-getaktet). Mit `--wheel` kommen echte Mausrad-Ereignisse
  (BiDi `input.performActions`, 100 px je Raste), die wie beim Nutzer durch Lenis laufen.
- Stationen (nur Dev, braucht `__v2.marks()`): Hero, Totale, Stückliste, Projekt 3, Verzeichnis.
  Gemessen werden der letzte gezeichnete Frame und eine GPU-Probe: 90 erzwungene Frames mit `gl.finish()`
  nach jedem Render. Das liefert eine Obergrenze für die GPU-Zeit, weil `EXT_disjoint_timer_query` in
  Firefox gesperrt ist.
- Normales Fenster: `--headed` (KWin/Wayland, Bildschirm 2880×1620 bei 1,54 Skalierung = 1858×1045
  logisch, 120 Hz). Ohne `--dpr` gilt die echte Bildschirm-DPR 1,54, der Renderer deckelt auf 1,5.
  1920×1080 passt logisch nicht auf den Schirm und läuft deshalb mit `--dpr 1.4`
  (`layout.css.devPixelsPerPx`).
- Firefox meldet als Renderer „Intel(R) HD Graphics, or similar“ (die Arc-iGPU, absichtlich ungenau),
  WebGL 2, MSAA 4×. Long-Task-API: in Firefox nicht vorhanden; lange Frames werden über Bildabstände
  > 25/50 ms erkannt.

### Zahlen

**Normales Firefox-Fenster (120 Hz), nachher**

| Lauf | Canvas (px) | Browser-fps | Szene-fps in Bewegung | `__v2.fps()` Median / P10 | schlechtestes 500 ms | längster Frame | JS/Frame P95 / max |
|---|---|---|---|---|---|---|---|
| Dev 1440×900, DPR 1,54 | 1381×1224 | 118,8 | 117,1 | 117,4 / 115,5 | 113,1 | 17 ms | 1,6 / 6,8 ms |
| Dev 1858×1045 (Vollbild), DPR 1,54 | 1924×1440 | 116,6 | 116,0 | 116,5 / 112,9 | 110,9 | 26 ms (1×) | 1,6 / 7,0 ms |
| Dev 1920×1080, DPR 1,4 | 1873×1388 | 117,5 | 116,3 | 116,7 / 114,3 | 113,1 | 26 ms (1×) | 1,7 / 7,2 ms |
| Prod 1440×900, DPR 1,54 | 1381×1224 | 118,7 | 117,0 | – (kein Hook) | 114,0 | 25 ms | 1,6 / 3,6 ms |
| Prod 1858×1045, **Mausrad** | 1924×1440 | 116,9 | 116,8 | – (kein Hook) | 111,6 | 25 ms | 1,7 / 7,2 ms |

**Headless (60-Hz-Takt), nachher**

| Lauf | Canvas | Browser-fps | Szene-fps in Bewegung | `__v2.fps()` Median / P10 | schlechtestes 500 ms | längster Frame |
|---|---|---|---|---|---|---|
| 1440×900 @1 | 910×900 | 60,0 | 60,0 | 60,0 / 59,9 | 59,9 | 17,2 ms |
| 1440×900 @1,5 | 1365×1350 | 60,0 | 60,0 | 60,0 / 60,0 | 59,9 | 17,2 ms |
| 1920×1080 @1 | 1332×1080 | 60,0 | 60,0 | 60,0 / 59,9 | 59,9 | 17,2 ms |
| 1920×1080 @1,5 | 1998×1620 | 60,0 | 60,0 | 60,0 / 60,0 | 59,9 | 17,1 ms |

**Stationen** (alle Läufe gleich): 18 Draw-Calls, 12 394 Dreiecke, 7 657 Linien, 5 Programme pro Frame.

| Station | Render-CB (Fenster, 1858×1045) | gl.finish (Fenster) | Render-CB (headless 1920 @1,5) | gl.finish (headless) |
|---|---|---|---|---|
| Hero | 0,4 ms | 2,0 ms | 0,7 ms | 1,2 ms |
| Totale | 0,4 ms | 1,7 ms | 0,8 ms | 1,4 ms |
| Stückliste | 0,4 ms | 1,7 ms | 0,8 ms | 1,4 ms |
| Projekt 3 | 0,4 ms | 2,2 ms | 0,7 ms | 1,4 ms |
| Verzeichnis | 0,5 ms | 2,1 ms | 0,8 ms | 1,5 ms |

Mit erzwungenem Zeichnen in jedem Frame schafft die Szene 125 fps (vsync-begrenzt), auch bei Canvas
1924×1440 mit MSAA. Füllrate und Draw-Calls sind also kein Engpass, und ein adaptiver DPR-Deckel bringt
auf diesem Gerät nichts.

**Weitere Werte**

- Gezeichnet wird in ~42 % der Frames beim Durchscrollen (Anteil je Zehntel der Strecke: 99 100 ~50 ~95
  ~20 15 ~28 ~18 0 0). Die Szene ruht dort, wo sich nichts an ihr ändert: Stückliste füllt sich, Text der
  Projekt-Datenblätter, Verzeichnis. Während einer Bewegung wird jeder Frame gezeichnet, ohne Lücken.
- Texturspeicher (Schätzung): neutrale Fläche + höchstens 5–6 Projekt-Screenshots (800 px breit,
  mit Mipmaps je ~1,9 MB), **max. 12,2 MB**. Gemessen am Ende 9,8 MB, weil Texturen außerhalb von ±2
  Projekten wieder freigegeben werden.
- Erzwungenes Layout (Lesen von Maßen nach DOM-Schreiben) je Frame: P95 ≤ 0,6 ms, max. 1,3 ms.
- GC/CC (über `MOZ_GCTIMER`/`MOZ_CCTIMER`): größte GC-Pause 28 ms, größte CC-Pause 17 ms. Beide liegen beim
  Laden der Seite oder ~30 s nach dem Firefox-Start (siehe Grenzen), nicht in der Scroll-Strecke.

**Vorher** (gleiche Methode, alte `fps()`-Definition, ohne Textur-Vorab-Upload)

| Lauf | Browser-fps | `__v2.fps()` Median / P10 / Mittel | schlechtestes 500 ms | teuerster Frame |
|---|---|---|---|---|
| Fenster 1440×900, DPR 1,54 | 119,7 | 116,0 / **29,0** / 77,8 | 112,0 | 12,2 ms JS (Projekt-Textur, Render 7,6 ms) |
| headless 1440×900 @1 | 60,0 | **25,6 / 15,0** / 37,6 | 59,9 | 10,0 ms |
| headless 1920×1080 @1,5 | 60,0 | **32,2 / 14,6** / 38,0 | 59,9 | 8,8 ms |

### Was geändert wurde

1. **`__v2.fps()` zählt Ruhepausen nicht mehr** (`src/scene/renderer.ts`, `drawnFps`, Test `tests/fps.test.ts`).
   Die alte Formel teilte die letzten 30 gezeichneten Frames durch die ganze Zeitspanne. Weil die Szene
   zwischen zwei Projekten absichtlich ruht (Rendern nur bei Änderung), zeigte sie beim Durchscrollen
   15–30 fps, obwohl jeder Bewegungs-Frame gezeichnet wurde. Jetzt zählen nur Abstände ≤ 100 ms.
   Echte Einbrüche (z. B. 40-ms-Frames) erscheinen weiterhin.
2. **Projekt-Screenshots werden gleich nach dem Laden hochgeladen** (`src/scene/screen.ts`:
   `renderer.initTexture`) statt im nächsten Render-Frame. Der teuerste Frame der Strecke fiel damit von
   8–12 ms (bei 120 Hz ein verlorener Frame) auf ≤ 4,7 ms im Render-Callback. Das Aussehen bleibt gleich.
3. Messwerkzeug: `tools/perf.mjs` und `npm run perf`. In `tools/ffbrowser.mjs` sind dazugekommen: Fenster-Modus
   (`headless: false` oder `FF_HEADED=1`), Prefs, Preload-Skripte, roher BiDi-Zugang und eine leere
   Startseite im Profil.

Nicht nötig waren: Kantenlinien zusammenführen (schon eine `LineSegments` je Teil, 7 657 Linien), DPR senken,
Geometrie vereinfachen, Antialiasing aus. Dafür gibt es keinen Messgrund, und das Aussehen bleibt.

### Bundle (Produktions-Build, `npm run build`)

| Chunk | roh | gzip | Inhalt |
|---|---|---|---|
| `scene` | 370 kB | 92,0 kB | three `WebGLRenderer` + Szene, Laptop-Modell |
| `screen` | 238 kB | 67,0 kB | **gemeinsamer Chunk**: three-Kern (`three.core`), `BufferGeometryUtils`, `screen.ts`, `projects.json` |
| `ScrollTrigger` | 113 kB | 44,5 kB | GSAP + ScrollTrigger |
| `timeline` | 14 kB | 6,2 kB | Choreografie |
| `smooth` | 19 kB | 5,7 kB | Lenis |
| `main` | 4,8 kB | 2,1 kB | Einstieg |
| `parts`, `state`, `directory` | 3,4 kB | 1,7 kB | |
| **Summe JS** | | **219 kB** | Grenze 350 kB |

- Der Chunk `screen` heißt nur so: Rolldown legt die Module, die `scene` und der dynamische Import von
  `scene/screen` (Verzeichnis-Hover in `main.ts`) gemeinsam brauchen, in einen Chunk. Der Name kommt vom
  ersten Einstieg. Er enthält den three-Kern, den die Szene ohnehin braucht, also keinen doppelten Code.
- Ladereihenfolge: `main` lädt `scene` per `import()`. Vite lädt dabei `scene`, `screen`, `parts` und
  `state` parallel vor (`__vite__mapDeps`), es gibt also keinen Wasserfall. Der spätere Import von
  `scene/screen` für das Verzeichnis trifft schon geladene Module.
- `projects.json` steckt vollständig im Szenen-Bundle (mit `desc`/`stack`/`repo` in zwei Sprachen,
  4,0 kB roh / **1,4 kB gzip**). Die Szene braucht nur `name`, `thumb` und `featured`. Ein Zuschnitt beim Build
  würde ~1 kB gzip sparen (< 0,5 % des Budgets), deshalb steht er nur als Vorschlag da.
- three nur über benannte Importe: ja (`from 'three'` mit Namen, `three/addons/...` nur
  `mergeGeometries`).

### Grenzen der Messung

- **Headless** taktet mit einem Software-60-Hz-Timer und hat keinen echten Compositor. Die Werte sind
  Richtwerte. Die Fenster-Läufe nutzen das echte Panel (120 Hz) und den echten Compositor (KWin/Wayland),
  aber ein frisches Profil, keine Erweiterungen und ein automatisch gesteuertes Fenster.
- `performance.now()` und rAF-Zeitstempel sind im Fenster auf ~1 ms gerundet (Bildabstände 8/9 ms bei
  120 Hz). Fürs Messen ist `privacy.reduceTimerPrecision` aus.
- `gl.finish()` misst GPU-Arbeit plus Synchronisation mit dem GPU-Prozess, also eine Obergrenze. Echte
  GPU-Timer sind in Firefox nicht verfügbar.
- **Firefox-Startarbeit:** Ein frisches Profil verlängert ~30 s nach dem Start einen einzelnen Frame um
  66–93 ms, unabhängig von Seite, Scroll-Stelle und JS (JS in dem Frame ≈ 0, auch bei einem 30-s-Lauf
  reproduziert). `perf.mjs` wartet deshalb bis 36 s nach dem Start (`--quick` überspringt das).
  Der fps-Wert von `npm run scroll-shots` („längster Frame 66–83 ms, schlechtestes 500-ms-Fenster ~48–54“)
  fällt genau in dieses Zeitfenster und ist daher kein Szenenproblem.
- Der Fehler „downloadable font: download failed … rsms.me/inter/…InterVariable-Italic.woff2“ (und
  `openng-icons` von start.garudalinux.org) kam von der **Startseite der Garuda-Distribution**
  (`/usr/lib/firefox/browser/defaults/preferences/all-companyname.js`:
  `browser.startup.homepage = https://start.garudalinux.org/`), nicht aus dem Projekt (`dist/` enthält
  weder `rsms` noch `InterVariable`). `ffbrowser.mjs` setzt im Testprofil jetzt `about:blank` als Startseite.
- Gemessen wurden nur `de` und Desktop. Handy-Layout (DPR 2) prüft T041/T071.

### Selbst messen (normales Firefox)

1. `npm run dev`, dann in Firefox `http://localhost:5173/` öffnen. Im Dev-Modus gibt es `window.__v2`.
   Nicht `?state={}` anhängen: `?state`/`?still` schalten die Scroll-Choreografie ab (contracts/dom.md),
   dann bewegt sich beim Scrollen nichts.
2. Konsole (F12) öffnen und eingeben:
   `setInterval(() => console.log(__v2.fps().toFixed(0)), 500)`
3. Mit dem Mausrad gleichmäßig von oben bis zum Projektverzeichnis scrollen. Die Werte sollten bei
   ~120 (120-Hz-Panel) bzw. ~60 liegen. `0` heißt: die Szene ruht gerade, es gibt nichts zu zeichnen.
   Zum Beenden `clearInterval(<Nummer>)` eingeben oder die Seite neu laden.
4. Für den Produktions-Build ohne Konsole: `npm run perf -- --prod --headed --wheel` öffnet ein
   Firefox-Fenster, scrollt per Mausrad und gibt alle Werte aus (ca. 1 min, Fenster nicht verdecken).

## Kontraste und Tastatur (T054, 2026-11-08)

Gerechnet mit `node tools/contrast.mjs` (liest die Farben aus `src/styles/tokens.css`, WCAG-2.x-Luminanz).
Maßstab: Text 4,5:1 (große Schrift 3:1), UI-Elemente und Fokusring 3:1.

| Paarung | Verhältnis | Mindest | Ergebnis |
|---|---|---|---|
| Text `--ink` auf `--paper` | 12,42:1 | 4,5 | ok |
| Text `--ink` auf `--paper-hi` (Schriftfeld, Tabellenkopf, Hover-Zeile) | 13,99:1 | 4,5 | ok |
| Text `--orange-ink` auf `--paper` (Link-Hover) | 4,95:1 | 4,5 | ok |
| Text `--orange-ink` auf `--paper-hi` | 5,57:1 | 4,5 | ok |
| Fokusring `--orange-ink` auf `--paper` | 4,95:1 | 3 | ok |
| Fokusring `--orange-ink` auf `--paper-hi` (Skip-Link, Schriftfeld) | 5,57:1 | 3 | ok |
| Label-Nummer `--ink` auf `--orange` (aktives Teil) | 5,24:1 | 4,5 | ok |
| Linien `--ink` auf `--paper` | 12,42:1 | 3 | ok |
| Stücklistenzeile während der Einblendung: `--ink` bei Deckkraft 0,75 / 0,5 | 6,11 / 2,97:1 | 4,5 | Übergang, Endzustand (Deckkraft 1) 12,42:1 |
| `--grid` auf `--paper` | 1,45:1 | – | nur Trennlinien, nie als Text (per grep geprüft) |
| Fokusring `--orange-ink` auf `--case` (dunkler Laptop) | 2,08:1 | 3 | nicht erfüllt, tritt nicht auf (s. u.) |
| Label-Linie `--ink` auf `--case` | 1,21:1 | 3 | nur Zierlinie über dem Gehäuse (s. u.) |

Ergebnis: Alle **Textfarben** erfüllen AA, es musste kein Token geändert werden (`--orange-ink` gab das Ziel ≈ 4,9:1 schon
vor). Grau wird nirgends für Text benutzt (`--grid` nur als Linie), Nebentexte (`.stack`, `.port`, Labels) sind `--ink`.
Die Stücklistenzeilen blenden nur ein und stehen im Endzustand mit Deckkraft 1 da; bei reduzierter Bewegung gibt es
gar keine Deckkraft-Animation (`reduced.css`).

Zu den zwei nicht erfüllten Zeilen:

- **Fokusring auf dem Gehäuse:** Fokussierbar sind nur Links im Textbereich. Der steht auf Papier (Desktop: Spalte links
  neben der Szene, Handy: unter der deckenden Bühne). Kein Fokusring liegt über dem Laptop; geprüft mit Screenshots aller
  Tab-Stopps. Wäre es nötig, ist `--orange` (#FF5F1F) mit 4,34:1 auf `--case` die Ausweichfarbe.
- **Label-Linien über dem Gehäuse:** Die Zierlinie und der Punkt (`--ink`) enden auf dem dunklen Teil und sind dort schwach.
  Die Information steckt in Nummernkreis (Papier) und Beschriftung (`--ink` auf Papier), nicht in der Linie. Aktive Linien
  sind `--orange-ink`. Nach WCAG 1.4.11 ist die Linie keine nötige Grafik. Nicht geändert, weil es das Zeichnungsbild ändern würde.

### Fokus und Anker per Tastatur

- Fokusring `:focus-visible`: 2px `--orange-ink`, Abstand 4px (`--line-bold`, `--s-1`), überall gleich (`base.css`);
  im Hochkontrast-Modus Systemfarbe `Highlight`. Anker-Ziele (Abschnitte, `tabindex="-1"`) bekommen keinen Ring.
- `scroll-padding-top`: Desktop `--s-5`, Handy `--stage-h + --s-4` (Fokus verschwindet nie unter der Bühne), unten `--s-5`.
- Tab-Reihenfolge = visuelle Reihenfolge (Skip-Link, Sprachumschalter, Hero, Stückliste, Projekte, … Schriftfeld), kein
  Fokus-Trap: nach dem letzten Link verlässt der Fokus die Seite, Shift+Tab läuft rückwärts durch alle Stopps.
- Fokus in gepinnten Abschnitten, in noch verdeckten Datenblättern, in noch nicht eingeblendeten Stücklistenzeilen und im
  Schriftfeld springt zur passenden Scroll-Position (`focusScrollY` in `score.ts`, `onFocusIn` in `timeline.ts`).
- Screenreader: `#scene` und `#labels` sind `aria-hidden`, Sprachumschalter mit `lang`/`hreflang` am Link, beide
  `nav` mit `aria-label`, Abschnitte mit `aria-labelledby`, externe Links mit „(öffnet in neuem Tab)“.

### Selbst prüfen

`node tools/focus-shot.mjs [--size 390x844]` startet Dev-Server und Firefox, klickt alle Anker (Ziel = Marke der Timeline,
±2 px), prüft `/#kontakt`, Zurück/Vor, läuft per echter Tab-Taste durch alle Stopps und danach rückwärts (je Stopp: im Bild,
deckend, Ring da) und schreibt Screenshots nach `test-results/shots/focus/<Breite>/`. Hinweis: das headless-Firefox-Fenster
ist nie „aktiv“ (`document.hasFocus()` ist false), dann liefert Firefox weder `focusin` noch `:focus`. Das Skript reicht
`focusin` deshalb von Hand nach und spiegelt die `:focus`/`:focus-visible`-Regeln der echten Stylesheets auf `[data-ring]`
(gleiche Tokens, anderer Selektor). In einem normalen Firefox-Fenster kommt beides von selbst.

## Bundle-Budget (T070, Stand Phase 11)

Werkzeuge: `npm run bundle` (`tools/bundle.mjs`, liest `dist/assets/*.js`, gzip per zlib Stufe 9, Exit 1 bei
> 350 kB) und `node tools/net.mjs` (Firefox gegen `vite preview`, listet die tatsächlich geladenen Dateien).

### Ergebnis kurz

- **JavaScript gesamt: 223,2 kB gzip** (Grenze 350 kB, 778 kB roh). Seit T034 (219 kB) nur +4 kB durch
  Phase 8–10 (Ersatzmodi, Fokus, englische Texte, Sprachumschalter). **Budget eingehalten, keine Optimierung nötig.**
- **Start ohne three:** HTML (`index.html` 4,2 kB gzip) + CSS 4,4 kB + `rolldown-runtime`, `label-keys`, `main`
  (zusammen **5,4 kB gzip JS**). Das Hero ist damit ohne three/gsap/Lenis lesbar und bedienbar; alles andere
  kommt per dynamischem `import()` (`media` → `scene`, `timeline`, `smooth`).
- Gesamtladung beim Öffnen (Firefox, Prod-Build, 1440×900, DE): JS 223,8 kB, CSS 4,8 kB,
  `explosion-still.webp` 59,2 kB, **2 WOFF2 = 128,6 kB**.

### Chunks (gzip)

| Chunk | roh | gzip | Inhalt |
|---|---|---|---|
| `scene` | 373,8 kB | 92,5 kB | three `WebGLRenderer` (`three.module`) + Szene, Laptop-Modell |
| `screen` | 238,5 kB | 66,3 kB | gemeinsamer Chunk: three-Kern (`three.core`), `BufferGeometryUtils`, `screen.ts`, `projects.json` |
| `gsap` | 70,0 kB | 27,1 kB | gsap-core + CSSPlugin (+ SplitText) |
| `ScrollTrigger` | 42,8 kB | 17,4 kB | ScrollTrigger + Observer |
| `timeline`, `smooth` | 15,5 / 20,4 kB | 6,5 / 6,1 kB | Choreografie, Lenis |
| `main` | 13,1 kB | 5,2 kB | Einstieg (inkl. Sprachumschalter) |
| `parts`, `media`, `directory`, `label-keys`, `rolldown-runtime` | | 2,1 kB | |
| **Summe** | 778 kB | **223,2 kB** | |

### three und gsap

- `grep "from 'three'" src`: 16 Dateien, **alle mit benannten Importen**, kein `import * as THREE`; aus
  `three/addons` nur `mergeGeometries` (`BufferGeometryUtils`, 4,2 kB roh).
- Quellkarten-Auswertung (temporärer Build mit Sourcemap in den Scratchpad, nicht im Projekt): three liegt im Build
  als vorgebündelte Dateien vor (`three.core.js` 217 kB und `three.module.js` 198 kB roh nach Tree-Shaking,
  zusammen ~420 kB roh von 778 kB), also keine Modulliste wie `three/src/...`. Der größte Teil ist
  `WebGLRenderer` samt Shader-Chunks und Programmverwaltung; das ist für jede Szene nötig. Keine Loader oder
  Renderer-Zusatzteile im Bundle (kein GLTFLoader, kein WebGPU). Vermeidbares: nichts.
- gsap: im Code importiert werden nur `gsap`, `gsap/ScrollTrigger` und `gsap/SplitText`. `Observer` und `CSSPlugin`
  zieht ScrollTrigger bzw. gsap selbst mit; das ist nicht zu entfernen.

### Schriften

- Im CSS stehen 7 `@font-face`-Schnitte (Archivo: latin, latin-ext, vietnamese; Martian Mono: latin, latin-ext,
  cyrillic, cyrillic-ext) mit `unicode-range`. **Geladen werden nur 2:** `archivo-latin` (90,1 kB) und
  `martian-mono-latin` (38,5 kB) = **128,6 kB**. Die anderen 5 (zusammen 207 kB) liegen in `dist/`, werden aber
  nie angefordert, solange kein Zeichen aus ihrem Bereich vorkommt (Ö/ä/ß gehören zu `latin`).
- Überlegung: Ungenutzte Schnitte aus dem Build zu streichen würde nur `dist/` verkleinern, nicht die Ladezeit.
  Deshalb unverändert gelassen.

### Sonstiges

- `explosion-still.webp` (59 kB) wird beim Start geladen (Standbild/Poster, Vorgabe aus Phase 8), `portrait.webp`
  und Projektbilder erst bei Bedarf.
- Vite-Hinweis `INEFFECTIVE_DYNAMIC_IMPORT` für `choreo/score.ts` (in `main.ts` dynamisch, in `lang.ts`/`timeline.ts`
  statisch importiert): harmlos, das Modul liegt ohnehin im `timeline`-Chunk, nur der dynamische Import bringt nichts.

## Ladezeit (T071, Fast 4G, 2026-11-08)

### Ergebnis kurz

- **SC-003 erfüllt, im Soll mit Reserve bei „bedienbar“, knapp bei „lesbar“.** Produktions-Build, gedrosselt auf Fast 4G
  (9 Mbit/s, 170 ms RTT), kalter Cache, je 5 Läufe, Median / schlechtester Lauf:
  - **Bedienbar** (Hero-Name sichtbar, Sprachumschalter klickbar, Lenis-Scrolling aktiv): Desktop **1,58 s / 1,60 s**,
    Handy **1,58 s / 1,58 s** (Soll ≤ 2,5 s).
  - **Lesbarer Inhalt** (Hero-Name im Bild, Intro vorbei): Desktop **1,36 s / 1,39 s**, Handy **1,19 s / 1,19 s**
    (Soll < 1,5 s); mit reduzierter Bewegung / ohne WebGL schon bei **0,77 s** (Text im DOM, Standbild als LCP).
  - **Übertragen: 414 KB** bis zur fertigen Szene (JS 220 KB gzip, Schriften 126 KB, Standbild 58 KB, HTML 4 KB,
    CSS 5 KB), 18 Anfragen. JS-Budget der Startseite (≤ 350 KB gzip) damit bestätigt.
- **Ein Eingriff:** die lateinischen Schriftschnitte (Archivo, Martian Mono) werden per `<link rel="preload">` angefordert
  (`vite.config.ts`, Plugin `preloadMainFont`). Vorher entdeckte der Browser sie erst nach dem Parsen des CSS.
  Wirkung auf Desktop: Hero-Name lesbar 1,56 s → **1,36 s**, bedienbar 1,76 s → **1,58 s** (vor dem Eingriff war das
  1,5-s-Ziel für „lesbar“ mit 1,56 s knapp verfehlt). Aussehen unverändert.
- **Auffälligkeit (nur vorgeschlagen, nicht geändert):** im 3D-Pfad steht der Hero-Text bis zum Szenenstart **unter** dem
  Standbild, außerhalb des ersten Bildschirms, und springt dann um 853 px (Desktop 1440×900) bzw. 388 px (Handy) nach
  oben. Siehe „Probleme und Vorschläge“.

### Methode

Werkzeug: `node tools/loadtime.mjs [--runs 5] [--scenario desktop|mobile|nojs|reduced|en|all] [--headed] [--json datei]`
(baut vorher `dist/`, nur Firefox 159 über WebDriver BiDi, `tools/ffbrowser.mjs`, kein Chrome).

- **Drosselung:** ein lokaler Node-Server (`tools/loadtime.mjs`, keine Abhängigkeit) liefert `dist/` aus und bildet Fast 4G
  nach: **9 Mbit/s Downlink**, gemeinsam für alle Verbindungen (FIFO in 8-KB-Stücken), **170 ms RTT** bis zum ersten Byte
  jeder Anfrage, **zusätzlich 170 ms für jede neue TCP-Verbindung** (Handshake), Text-Dateien **gzip -9**, Bilder/Schriften
  unverändert, `Cache-Control: no-store`. Upload (1,5 Mbit/s) spielt bei winzigen GET-Anfragen keine Rolle und ist nicht
  nachgebildet. Der BiDi-Befehl `network.setNetworkConditions` ist in Firefox nicht vorhanden; ein Proxy war nicht
  nötig, weil der Server die Drosselung selbst übernimmt. Gemessen wird also der Produktions-Build, nicht ein Live-Host.
- **Kalter Cache:** pro Lauf ein frisches Profil und ein neuer Firefox, `browser.cache.disk.enable=false`,
  `browser.cache.memory.enable=false`. Messung beginnt 1,5 s nach dem Start des Browsers (die ~30 s-Hintergrundarbeit des
  frischen Profils fällt damit nicht in die Messung).
- **Metriken** (Preload-Skript, Zeiten ab Navigationsbeginn): FCP und LCP aus `PerformanceObserver` (`paint`,
  `largest-contentful-paint`); **lesbar** = erster Frame, in dem `#hero-title` im Viewport liegt, Deckkraft 1 und
  `html.intro` weg ist; **bedienbar** = Zeitpunkt, an dem zusätzlich der Sprachumschalter per `elementFromPoint`
  klickbar ist und Lenis aktiv ist (`html.lenis`, ohne 3D entfällt Lenis); **Szene** = `html.scene-ready`;
  **TBT-Proxy** = Summe von (rAF-Lücke − 50 ms) zwischen FCP und „bedienbar“ (Firefox hat keine Long-Task-API);
  **Bytes** = `transferSize` der Resource-Timing-Einträge bzw. Server-Log (Body + ~200 B Header je Anfrage).
- **CLS:** Firefox kennt die `layout-shift`-API nicht. Ersatz: je Frame Position von Hero-Name, Hero-Zeile und
  Sprachumschalter vergleichen und Sprünge > 1 px samt Zeitpunkt und Weite protokollieren. Das ist **kein CLS-Wert**,
  nur ein Hinweis, ob etwas springt.
- **Szenarien:** Desktop 1440×900 DPR 1 (3D); Handy 390×844, DPR 3, Touch (3D, kompakt); reduzierte Bewegung
  (`ui.prefersReducedMotion=1`, Standbild); ohne JavaScript (`javascript.enabled=false`); englische Seite (Desktop).
  Ohne JS läuft im Seitenkontext nichts, dort werden nur DOMContentLoaded und `load` am Node-Prozess gestoppt
  (zwei getrennte Kaltladungen) und Bytes aus dem Server-Log gezählt.

### Zahlen (nach dem Eingriff, headless, je 5 Läufe, Median / schlechtester Wert in ms)

| Szenario | FCP | LCP (Element) | Hero-Name lesbar | Szene bereit | **bedienbar** | `load` | TBT-Proxy | größte rAF-Lücke | KB bis bedienbar / gesamt |
|---|---|---|---|---|---|---|---|---|---|
| Desktop 1440×900, 3D | 785 / 800 | 963 / 981 (Standbild) | 1363 / 1387 | 1413 / 1438 | **1575 / 1598** | 963 / 980 | 18 / 24 | 68 / 74 | 410 / 414 |
| Handy 390×844 @3, 3D | 782 / 783 | 972 / 973 (Standbild) | 1188 / 1188 | 1406 / 1407 | **1575 / 1584** | 972 / 973 | 10 / 30 | 60 / 80 | 410 / 413 |
| Desktop reduziert | 780 / 795 | 971 / 987 (Standbild) | 765 / 775 (im DOM) | – | **765 / 775** | 970 / 987 | 0 / 0 | – | 137 / 226 |
| Desktop ohne JS | – | – | DCL 389 / 437 | – | – | 1300 / 1304 | – | – | – / 224–350 |
| Desktop en, 3D (Stichprobe) | 794 / 854 | 955 / 1048 (Standbild) | 1367 / 1438 | 1415 / 1492 | **1580 / 1653** | 955 / 1048 | 28 / 29 | 78 / 79 | 410 / 413 |

Gesamtübertragung (3D, gzip): HTML 4,4 KB, CSS 4,6 KB, JS 220 KB (scene 93, screen 67, gsap 27, ScrollTrigger 18, Rest 15),
Schriften 129 KB (Archivo-latin 90, Martian-Mono-latin 39), Standbild 59 KB. Projektbilder und Porträt (`loading="lazy"`,
11–29 KB je Bild) werden beim ersten Laden nicht angefordert. Konsolenfehler: 0 in allen Läufen.

Vorher / nachher beim Schrift-Preload (Desktop 3D, Median): Hero-Name lesbar 1556 → 1363 ms, Szene bereit 1605 → 1413 ms,
bedienbar 1763 → 1575 ms. Zwischenstand nur mit Archivo-Preload: 1473 / 1517 / 1684 ms. Rohdaten:
`test-results/perf/load-fast4g-before-preload.json`, `…-preload-archivo.json`, `load-fast4g.json` (je mit Server-Log aller
Anfragen), Konsolenausgabe in den `.log`-Dateien.

Kontrolle im normalen Firefox-Fenster (Wayland, `--headed`, Desktop, 3 Läufe): FCP 765, LCP 952, Hero lesbar 1472 (noch ohne
Martian-Preload), bedienbar 1681, TBT-Proxy 11 ms. Gleiche Größenordnung wie headless, Messfehler also nicht von der
Headless-Darstellung getrieben.

### Soll / Ist (SC-003, Constitution III)

| Kriterium | Soll | Ist (Median, schlechtester) | |
|---|---|---|---|
| Lesbarer Inhalt, Desktop 3D | < 1,5 s | 1,36 s, 1,39 s (en: 1,37 s, 1,44 s) | erfüllt, knapp (ohne Preload 1,56 s) |
| Lesbarer Inhalt, Handy 3D | < 1,5 s | 1,19 s, 1,19 s | erfüllt |
| Lesbarer Inhalt, reduziert / ohne WebGL | < 1,5 s | 0,77 s, 0,78 s | erfüllt |
| Bedienbar, Desktop 3D | ≤ 2,5 s | 1,58 s, 1,60 s | erfüllt (Reserve 0,9 s) |
| Bedienbar, Handy 3D | ≤ 2,5 s | 1,58 s, 1,58 s | erfüllt (Reserve 0,9 s) |
| Bedienbar, reduziert | ≤ 2,5 s | 0,77 s, 0,78 s | erfüllt |
| JS der Startseite | ≤ 350 KB gzip | 220 KB | erfüllt |

### Probleme und Vorschläge

1. **Hero-Text liegt im 3D-Pfad unter dem Standbild und springt (wichtigster Fund).** Bis `scene-on` bleibt
   `#scene-fallback` im Fluss (Seitenkopf, dann Standbild 1600:1000, dann `main`). Bei 1440×900 steht `#hero-title` deshalb bei
   y = 979 px, also außerhalb des ersten Bildschirms; `html.intro` hält ihn zusätzlich verdeckt. Erst wenn die Szene-Chunks
   geladen sind (~1,4 s), wird das Standbild ausgeblendet und der Hero-Text rückt um 853 px (Handy: 388 px) nach oben.
   Folgen: „lesbar“ hängt am Szenenstart statt am Text, ein Browser mit `layout-shift`-API (Chrome/Lighthouse) würde das als
   große Verschiebung zählen (hier nicht messbar), und das 900-ms-Hero-Intro läuft teilweise außerhalb des Bildes.
   Ursache: Platzhalter-Layout und Endlayout sind verschieden. **Vorschlag (ändert das Aussehen, deshalb nicht umgesetzt):**
   im JS/WebGL-Pfad das Standbild aus dem Fluss nehmen (`html.js:not(.reduced):not(.no-webgl) #scene-fallback`
   `position: fixed` auf die Szenenfläche, `z-index: -1`) und den Hero mit `min-height: 100svh` wie im Endlayout stehen
   lassen. Dann steht der Name ab FCP (~0,8 s) im Bild und es springt nichts mehr.
2. **Szene-Kette als Wasserfall.** HTML → `main`-Chunk (0,74 s) → `media` (0,95 s) → `timeline`/`ScrollTrigger`/`gsap`
   (1,01–1,19 s) → `scene` (93 KB, angefordert erst bei 1,02 s, fertig 1,43 s) und `screen` → `smooth` (1,50 s) → `directory`
   (1,70 s). Jede Stufe kostet 170 ms RTT, weil der nächste Import erst nach dem vorigen Modul bekannt ist. **Vorschlag:**
   `modulepreload` für `scene`, `screen`, `gsap` und `timeline` in der HTML (Vite setzt es nur für statische Importe;
   ein kleines Plugin wie `preloadMainFont` kann die gehashten Namen eintragen). Erwartung: Szene bereit ≈ 1,0–1,1 s (dann
   begrenzt die Bandbreite: 410 KB bei 9 Mbit/s ≈ 0,4 s plus Handshakes). Nebenwirkung: das Standbild (LCP) konkurriert um
   Bandbreite, deshalb vorher/nachher messen. Nicht umgesetzt, weil mehr als eine Kleinigkeit.
3. **Lenis kommt zuletzt** (`smooth`-Chunk nach `scene-ready`), „bedienbar“ endet dadurch ~0,16 s nach der Szene. Die Seite
   lässt sich schon vorher nativ scrollen, kein Handlungsbedarf.
4. **Bilder und Schriften unauffällig.** Standbild 59 KB WebP (LCP, 0,96 s, beim Start nötig), Projektbilder/Porträt
   `lazy` mit `width`/`height`, nur 2 von 7 Schriftdateien werden geladen (kein Fremdschrift-Blockieren: `font-display: swap`).
   `fetchpriority="high"` am Standbild brächte hier nichts: seine Anfrage wartet auf eine freie der 6 HTTP/1.1-Verbindungen
   (738 ms), nicht auf Prioritäten.
5. **Kleine Verschiebungen bleiben:** Zeichnungskopf auf dem Handy springt beim Schriftwechsel (Sprachumschalter 45 → 161 px
   bei ~0,79 s, in der Messung ohne Martian-Preload ähnlich), im reduzierten Modus rückt die Hero-Zeile beim Schriftwechsel
   um 29 px. `size-adjust`/`ascent-override` im `@font-face` der Ersatzschrift würde das beruhigen (Vorschlag, nicht umgesetzt).

### Grenzen der Messung

- Headless-Firefox (60-Hz-Takt, Software-/Standard-GL), 3 Läufe im Fenster zur Kontrolle. Die Szene-Zeit enthält Shader- und
  Texturaufbau auf dieser Maschine (Arc-iGPU); auf einem schwächeren Handy ist `scene-ready` später, die Netzwerkzeit
  bleibt gleich. Keine Mobile-CPU-Drosselung, Handy = nur Viewport/DPR/Touch.
- Drosselung im Server, nicht im Browser: kein TLS-Handshake, kein HTTP/2 (Firefox öffnet hier höchstens 6 Verbindungen je
  Host, jede mit +170 ms), keine TCP-Slow-Start-Kurve. Auf einem echten Host mit HTTP/2/3 und Brotli wären Wasserfall und
  Bytes eher etwas besser. Gemessen wird der lokale Produktions-Build wie in SC-003 verlangt, nicht ein Live-Host.
- Kein LCP-Wert für Text: der LCP ist im 3D-Pfad immer das Standbild. TBT ist ein Näherungswert (rAF-Lücken).
- Ohne JS schwanken die Bytes (224–350 KB), weil Firefox `loading="lazy"` ohne Skripting nicht immer einhält; für ein
  FCP/LCP ohne JS gibt es keine Messung (kein Skript im Seitenkontext), nur DCL/`load`.

### Selbst messen

`node tools/loadtime.mjs --runs 5 --json test-results/perf/load-fast4g.json` (alle Szenarien, ~6 min) oder
`--scenario desktop --runs 3 --headed` für das normale Fenster. `--no-throttle` zeigt die Werte ohne Drosselung,
`--no-build` überspringt `npm run build`.
