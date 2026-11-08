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
