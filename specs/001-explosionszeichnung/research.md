# Research: Portfolio „Explosionszeichnung“

Alle technischen Fragen sind entschieden; es gibt keine offenen NEEDS CLARIFICATION.

## R1 – Laptop-Modell: prozedural statt glTF

- **Decision**: Den Laptop im Code aus Grundformen bauen: Keil-Unterteil als extrudiertes Seitenprofil,
  Deckel als abgerundete Box, Tasten als `InstancedMesh`, Anschlüsse als kleine Boxen, Innenleben
  (Mainboard, Chips, Akku-Zellen, Lüfter, SSD) als einfache Formen. Maße in mm aus
  `docs/referenz/laptop/README.md`, Szeneneinheit 1 = 100 mm.
- **Rationale**: Jedes Teil ist von Anfang an ein eigenes Objekt mit eigenem Drehpunkt (das braucht die
  Explosion). Die Datei bleibt winzig (Constitution III), es gibt kein Lizenzproblem und das Herstellerlogo
  fehlt automatisch. Der `teardown`-Skill baut seine Maschinen genauso, seine Sims dienen als Vorlage.
- **Alternatives**: Ein fertiges glTF von Sketchfab hat unklare Lizenz und die falsche Teilung, ein eigenes
  Blender-Modell kostet viel Zeit. Bleibt als Upgrade-Pfad offen, falls die prozedurale Form zu grob wirkt.

## R2 – Look „technische Zeichnung“ in 3D

- **Decision**: Flache, matte Materialien (`MeshLambertMaterial` oder `MeshToonMaterial` mit 3-Stufen-Verlauf)
  in Papier-/Grautönen plus dunkle Kantenlinien (`EdgesGeometry` → `LineSegments`, Schwellwinkel ~30°).
  Das aktive Teil bekommt Orange als Flächenton, inaktive Teile werden zu reinen Linien (Ghost).
  Kein Echtzeit-Schatten, nur eine weiche Kontaktschatten-Textur unter dem Gerät.
- **Rationale**: Wirkt wie eine Explosionszeichnung statt wie ein Produktfoto, passt zum Papier-Look und
  ist billig für die iGPU.
- **Alternatives**: PBR mit Umgebungslicht sieht zu sehr nach Produktrender aus und ist teurer.
  Ein Outline-Postprocessing-Pass wäre ein zusätzlicher Renderpass.

## R3 – Beschriftungen und Linien als HTML/SVG-Overlay

- **Decision**: Jedes Teil hat einen 3D-Ankerpunkt. Pro Frame wird er auf Bildschirmkoordinaten projiziert.
  Die Beschriftungen sind absolut positionierte HTML-Elemente (Mono-Schrift), die Linien ein SVG-Overlay.
  Die Texte kommen aus dem Dokument (übersetzt), die Szene liefert nur Koordinaten.
- **Rationale**: Scharfe Schrift, übersetzbar, für Screenreader ausblendbar und kein Text-Rendering in WebGL.
  Hält die Trennung „Szene kennt keine Texte“ ein (Constitution, Gestaltung & Technik).
- **Alternatives**: `CSS2DRenderer` aus three/addons ginge auch, aber die eigene Projektion ist ~30 Zeilen
  und steuert die Linien gleich mit. Text als Sprite/Troika ist schwerer und unscharf.

## R4 – Scroll-Steuerung: GSAP ScrollTrigger + Lenis, ein Zustandsobjekt

- **Decision**: Ein einziges Zustandsobjekt `sceneState` (Deckelwinkel, Explosionsgrad 0–1, aktives Teil,
  Kamera-Keyframe-Index + Mischung). Eine Master-Timeline mit `scrub` und Labels pro Abschnitt schreibt
  nur in dieses Objekt. Die Szene liest es pro Frame. Lenis übernimmt Smooth Scroll:
  `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`,
  `gsap.ticker.lagSmoothing(0)`.
- **Rationale**: Choreografie und Szene sind entkoppelt, und die Explosion ist als reine Funktion
  `pose(part, state)` testbar. Bei Sprüngen (Anker, Pos1/Ende) setzt Scrub den Zustand direkt.
  Die `gsap-skills` (gsap-scrolltrigger, gsap-timeline, gsap-performance) decken genau dieses Muster ab.
- **Alternatives**: three.js-Objekte direkt mit GSAP tweenen erzeugt viele Tweens, Zustand verteilt sich
  und ist schwer testbar. CSS Scroll-Driven Animations können kein WebGL steuern, und Firefox-Support
  ist uneinheitlich.

## R5 – Reduzierte Bewegung, Handy, kein WebGL

- **Decision**: `gsap.matchMedia()` mit drei Fällen: `(prefers-reduced-motion: no-preference) and
  (min-width: 768px)` volle Choreografie, `… and (max-width: 767px)` kürzere Strecken und Datenblätter
  unter dem Modell, `(prefers-reduced-motion: reduce)` keine Timeline, kein Lenis, kein Pinning.
  Ohne WebGL (Test per `canvas.getContext('webgl2')`) und bei reduzierter Bewegung kommt ein
  `<picture>` mit Standbild (`public/img/explosion-still.webp`, hell). Das Bild erzeugt das Screenshot-Tool
  aus dem `?still`-Modus der Seite.
- **Rationale**: Constitution I. `matchMedia` räumt beim Umschalten automatisch auf.
- **Alternatives**: Ein vereinfachtes 3D bei reduzierter Bewegung wäre immer noch Bewegung.

## R6 – Zwei Sprachen aus einer Quelle mit Vite

- **Decision**: Die Template-Engine aus v1 (`~/Projects/portfolio/tools/build.mjs`, Mustache-Teilmenge,
  Fehler bei fehlender Übersetzung) wird nach `tools/render.mjs` portiert. Ein kleines Vite-Plugin
  (`tools/vite-plugin-pages.mjs`) rendert vor dem Build und bei Änderungen im Dev-Server
  `src/page.html` + `src/sections/*.html` + `src/content/*.json` zu `index.html` (de) und `en/index.html` (en).
  Beide sind Vite-Einstiege (`build.rollupOptions.input`). Die erzeugten HTML-Dateien sind gitignored.
- **Rationale**: Bewährt aus v1 (Constitution II), keine neue Abhängigkeit, und Vite bündelt JS/CSS für
  beide Seiten gemeinsam.
- **Alternatives**: i18n zur Laufzeit per JS widerspricht „ohne JS lesbar“. Astro wurde verworfen (Stack-Entscheidung).

## R7 – Schriften und Fremdquellen

- **Decision**: Schriften selbst hosten (`@fontsource/*` im Projekt oder WOFF2 in `public/fonts/`),
  kein Google-Fonts-CDN. Welche Schriften, entscheidet der Designplan (T010) mit `frontend-design`.
  Kandidaten: eine Grotesk mit Charakter für Titel plus eine technische Mono für Teilenummern und Maße.
- **Rationale**: Datenschutz (DSGVO, keine IP an Google), offline-fähig, kein Layout-Springen.

## R8 – Tests und optische Kontrolle ohne Chromium

- **Decision**: **Vitest** für Unit-/Datentests: Explosionsmathematik, Choreografie-Grenzen,
  Übersetzungen vollständig, Projektdaten/Assets vorhanden, Render der Seiten ohne Fehler.
  Für die Optik gibt es `tools/shot.mjs`: System-Firefox headless über WebDriver BiDi, nach dem Muster von
  `~/.claude/skills/teardown/ff/ffbrowser.mjs` (dort von Rustam für Firefox gepatcht). Es öffnet
  `vite preview`, springt jeden Abschnitts-Anker bei 1440 und 390 px an, speichert PNGs nach
  `test-results/shots/` und bricht bei Konsolenfehlern ab. Mit `--still` erzeugt es das Fallback-Bild.
- **Rationale**: Constitution V (nie headless Chrome). Keine Playwright-Browser-Downloads nötig.
- **Alternatives**: Playwright mit Chromium ist verboten. Playwright-Firefox bräuchte einen eigenen
  gepatchten Firefox-Download (~80 MB) und zeigt das gleiche Ergebnis.

## R9 – Performance auf der Intel-Arc-iGPU

- **Decision**: `renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 2 : 1.5))`, `antialias: true`
  nur bei DPR < 2. Gerendert wird nur bei Änderung: ein `needsRender`-Flag, gesetzt von
  ScrollTrigger-Updates und laufenden Tweens. `IntersectionObserver` und `visibilitychange` pausieren.
  Ein Material pro Ton, Tasten als ein `InstancedMesh`, Kantenlinien zusammengeführt pro Teil.
  three.js nur über benannte Importe.
- **Rationale**: Constitution III, SC-002. Die `gsap-performance`-Hinweise gelten fürs Overlay
  (nur `transform`/`opacity` animieren).

## R10 – Remotion

- **Decision**: Gehört nicht zu Feature 001. Möglicher Folgeschritt (Feature 002): kurze Loops pro
  Projekt mit Remotion als WebM rendern und statt der Screenshots aufs Display legen.
- **Rationale**: YAGNI. Screenshots aus v1 sind sofort da, und Clips sind ein reines Upgrade.
