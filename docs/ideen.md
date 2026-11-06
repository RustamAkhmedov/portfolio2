# Richtungen für portfolio_v2

Stand 2026-11-06 · Inhalte wie in v1 (gen_Ut, fretlearn, Weitland, NSCS, OnlineIDE, …, de/en).
Gemeinsam für alle: GSAP ScrollTrigger + Lenis, `prefers-reduced-motion` = ruhige Fassung ohne Scrub,
statisch auf GitHub Pages möglich, 3D leicht genug für die Intel-iGPU (prozedurale Geometrie statt
großer Modelle, Pixelratio begrenzen, Rendern pausieren, wenn nicht sichtbar).

## A · Explosionszeichnung (Empfehlung)

Ein 3D-Gerät – „Rustams Rechner“ – im Hero. Beim Scrollen klappt es auf und zerlegt sich in Teile.
Jedes Teil ist ein Abschnitt: Display → Projekte, CPU → Skills/Stack, Akku → Über mich,
Anschlüsse → Kontakt. Teile hängen an Beschriftungslinien wie in einer technischen Zeichnung.

- **Look:** Blaupause/technisches Datenblatt – helles Papier oder tiefes Blau, feine Linien,
  Mono-Beschriftung (Teilenummern, Maße), eine Signalfarbe (Orange).
- **Scroll:** gepinnter Hero, Scrub über die Explosion, dann je Teil ein gepinnter Abschnitt.
- **Warum:** passt zu dir (Linux-Basteln, Kernel-Bugs jagen, teardown-Skill), sieht niemand
  anders aus, gleiche three.js-Bauweise wie teardown.
- **Risiko:** das Gerät muss gut modelliert sein, sonst wirkt es billig.

## B · Das Zimmer (Diorama)

Ein Low-Poly-Zimmer in Iso-Ansicht: Schreibtisch, Laptop, Gitarre (fretlearn), Bücherstapel (gen_Ut),
Fenster mit Plattenbau-Aussicht (Weitland), Drucker, Katze Lizzie. Scroll fährt die Kamera von Objekt
zu Objekt; jedes Objekt öffnet ein Projekt. Licht wechselt mit dem Scroll von Tag zu Nacht.

- **Look:** warm, matte Farben, weiche Schatten, verspielt, aber aufgeräumt.
- **Warum:** am persönlichsten, trägt die Persönlichkeit von rustam.os (Katze!) in modernes 3D.
- **Risiko:** am meisten Modellierarbeit; viele Objekte = mehr GPU-Last.

## C · Kinetic Editorial

Kaum 3D. Riesige Typografie (variable Schrift), SplitText-Reveals, eine gepinnte horizontale
Projektgalerie, deren Screenshots beim Scrollen per WebGL-Shader leicht verzerren, Stack als Laufband.

- **Look:** Schweizer Raster, Schwarz/Creme, eine Akzentfarbe, viel Weißraum.
- **Warum:** schnell, robust, top auf dem Handy, Agentur-/Awwwards-Stil.
- **Risiko:** kippt leicht ins Generische – braucht eine eigene Idee (z. B. Typo aus Terminal-Zeichen).

## D · Vom Terminal zur Welt

Start wie v1: schwarzer Bildschirm, blinkender Cursor, `./portfolio` tippt sich. Dann zerfällt das
Terminal in eine Partikelwolke, die sich pro Abschnitt zu einem Objekt formt (Gitarre, Buch, Katze,
Plattenbau) und beim Scrollen weitermorpht.

- **Look:** dunkel, Punktwolken, eine Leuchtfarbe, Mono-Schrift.
- **Warum:** Brücke zwischen v1 und v2, sehr „wow“ beim ersten Laden.
- **Risiko:** Partikel-Morphs brauchen Performance-Pflege auf der iGPU; Inhalt darf nicht untergehen.

## Kombinierbar

- D's Terminal-Intro vor A oder B setzen.
- C als Grundgerüst (Typo, Raster) für die Textteile von A oder B.
- Remotion: einen kurzen Loop pro Projekt rendern (Projekt-Teaser) statt statischer Screenshots.

## Entscheidungen

- 2026-11-06: **Richtung A · Explosionszeichnung** gewählt.
- 2026-11-06: **Stack: Vite + TypeScript + three.js**, GSAP/ScrollTrigger + Lenis, kein Framework.
  Remotion nur als gerenderte Clips, kein React Bits.
- 2026-11-06: **Gerät: stilisierter Laptop** (Display, Tastatur, Mainboard/CPU, Akku, SSD, Anschlüsse).
- 2026-11-06: **Look: Papier-Datenblatt** (warmes Papier, feine Linien, Mono-Labels, Orange als Signalfarbe).
- 2026-11-06: **de + en** aus einer Quelle, Inhalte aus v1 übernehmen.
- 2026-11-06: **Inhalte: Top-Auswahl** (Über mich, Skills, 5–6 Top-Projekte, Lebenslauf, Kontakt).
- 2026-11-06: ~~Planung: Spec unter `docs/`~~ → **doch Spec Kit** (Rustams Wunsch). Ergebnis:
  `.specify/memory/constitution.md` + `specs/001-explosionszeichnung/`.
- 2026-11-06: Abschnitts-Zuordnung: Display → Projekte, Mainboard/CPU → Skills, Akku → Über mich,
  SSD → Lebenslauf, Anschlüsse → Kontakt (Tastatur, Lüfter, Bodenplatte nur in der Stückliste).
- 2026-11-06: **Gehäusefarbe: Neutral Black** (Rustams Gerät) → dunkles, mattes Anthrazit im Modell.

## Offene Fragen

1. ~~Welche Richtung (oder Mischung)?~~ → A
2. Stack: Vite + TypeScript + three.js (schlank, wie teardown) **oder** React + React Three Fiber
   (nötig für React Bits und `@remotion/player`)?
3. Zweisprachig de/en wie v1?
4. Spec Kit einrichten oder Spec unter `docs/` reicht?
