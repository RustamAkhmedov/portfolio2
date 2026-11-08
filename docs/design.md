# Designplan „Papier-Datenblatt“ (T010)

Stand 2026-11-08 · **Von Rustam abgenommen.** Jetzt T011 (Tokens, Schriften).
Alle Werte unten werden 1:1 zu CSS-Variablen in `src/styles/tokens.css`. Nichts im Code darf einen
Wert außerhalb der Tokens benutzen.

## Gegenstand

Portfolio eines Schülers/Entwicklers (Linux, Kernel-Bugs, Eigenbau). Die Seite ist eine **Explosionszeichnung auf einfarbigem Papier** (kein Zeichenblatt mit Raster oder Rahmen):
ein Laptop wird beim Scrollen zerlegt, jedes Teil ist ein Abschnitt. Aufgabe der Seite: in einer Minute zeigen,
was Rustam gebaut hat (6 Hauptprojekte), und Kontakt herstellen. Der zerlegte Laptop ist die eine Idee, alles andere bleibt leise.

Bibliotheken (laut Projektentscheidung schon gesetzt): **GSAP + ScrollTrigger + SplitText** und **Lenis**.
Kein React Bits (hier Template-Tell), Remotion nur später für gerenderte Clips.

## Farbe (Tokens)

| Token | Hex | Rolle |
|---|---|---|
| `--paper` | `#E7E3D8` | Blatt, Hintergrund. Graustichiges Zeichenkarton-Beige, bewusst weder Creme noch Gelb |
| `--paper-hi` | `#F3F0E8` | Schriftfeld, Datenblatt-Flächen, Tabellenkopf |
| `--ink` | `#1B2230` | Text und Konturen. Blauschwarze Tuschetinte statt Schwarz |
| `--grid` | `#B8BFC6` | Trennlinien, Tabellenlinien (helleres Grau neben `--ink`) |
| `--orange` | `#FF5F1F` | Signalfarbe: aktives Teil, Zählwerte, Füllungen. Reines Signalorange, kein Terrakotta |
| `--orange-ink` | `#AE3500` | Orange als **Text** und Fokusring (Kontrast auf Papier ≈ 4,9:1) |
| `--case` | `#2E3036` | Gehäuse des Laptops (Neutral Black, matt) |
| `--case-edge` | `#CFC9BA` | Kantenlinien **auf** dem Gehäuse (Tinte würde auf Anthrazit verschwinden) |

Regeln: Orange ist die einzige Farbe. Auf Papier nie Orange als kleinen Text (nur `--orange-ink`).
Text auf Orange-Fläche ist `--ink` (≈ 5:1). Kein Verlauf, kein Schatten als Dekor. Dunkelmodus gibt es nicht
(Papier bleibt Papier); `color-scheme: light`.

Gehäuse-Lesbarkeit: Der Laptop ist die einzige dunkle Fläche der Seite und hebt sich dadurch vom Papier ab.
Kanten (30°-Schwelle) in `--case-edge` mit ~0,6 Deckkraft. Ghost-Teile (nicht aktive) sind reine Linien in `--ink`
ohne Füllung. Das aktive Teil bekommt `--orange` als Fläche, Kanten in `--ink`.

## Schrift (selbst gehostet über `@fontsource-variable`, kein CDN)

- **Archivo** (variabel, `wdth` 62–125, `wght` 100–900): Überschriften, Fließtext. Die Breitenachse erlaubt
  einen schmalen, schweren Zeichnungs-Look für Titel (`wdth 75`, `wght 800`) und normale Breite im Text (`wdth 100`).
  Keine der üblichen Reflex-Schriften (Inter, Space Grotesk, Roboto).
- **Martian Mono** (variabel): ausschließlich **Daten**: Teilenummern (P-01), Maße, Spezifikationen, Stückliste,
  Nicht für Fließtext, nicht für Navigation.

Skala (Verhältnis ≈ 1,25, Hero und H2 fluid per `clamp`):

| Stufe | Größe | Zeile | Verwendung |
|---|---|---|---|
| `--t-data` | 0,75rem (12px) | 1,4 | Mono-Daten |
| `--t-small` | 0,875rem | 1,5 | Nebentext, Tabellen |
| `--t-body` | 1,0625rem (17px) | 1,55 | Fließtext, ≤ 62 Zeichen Zeilenlänge |
| `--t-lead` | 1,3125rem | 1,4 | Einleitungen |
| `--t-h3` | 1,625rem | 1,2 | Projektnamen |
| `--t-h2` | clamp(2.25rem, 4vw+1rem, 3.75rem) | 1,05 | Abschnittstitel, `wdth 75` |
| `--t-hero` | clamp(3.5rem, 9vw+1rem, 9rem) | 0,92 | Name im Hero, `wdth 75`, `wght 800`, Laufweite −0,02em |

Keine Großbuchstaben-Labels, keine Eyebrows über jeder Überschrift. Beschriftungen stehen im Satzbau
(„Akku“, nicht „AKKU“). Mono-Daten bleiben in ihrer Schreibweise (P-03, 75 Wh).

## Linien

| Token | Wert | Verwendung |
|---|---|---|
| `--hair` | 0,5px (min. 1 Gerätepixel) | Maßhilfslinien |
| `--line` | 1px | Konturen, Tabellenlinien, Beschriftungslinien |
| `--line-bold` | 2px | aktives Teil, Fokus |

- **Hintergrund**: eine einzige Fläche in `--paper`. Kein Raster, kein Rahmen, keine Zonenmarken.
- **Explosionsachsen**: Strich-Punkt-Linien (DIN-Mittellinie) durch die Teile, in `--ink`, 1px.
- **Teilenummern** (Positionsnummern): Kreis ⌀ 28px, `--line`, Mono-Zahl „01“ darin; Beschriftungslinie vom
  Kreis zum Teil, am Ende ein ausgefüllter Punkt (3px). Aktives Teil: Kreis gefüllt `--orange`, Zahl `--ink`.
- **Ecken**: `border-radius: 0` überall. Ausnahme Kreise der Teilenummern.

## Abstände

4px-Raster, Tokens `--s-1`…`--s-9` = 4, 8, 12, 16, 24, 32, 48, 72, 120 px. Seitenrand `--gutter`
`clamp(16px, 4vw, 64px)`. Abschnitte trennt Raum, keine Karten; Gruppen entstehen durch Linien (`--line`),
nicht durch Kästen mit Schatten.

## Layout

Textspalte links, ragged right, Laptop nimmt die rechte/mittlere Fläche ein; auf dem Handy Laptop oben, Text darunter.
Alles linksbündig, nichts zentriert außer dem Hero-Schriftfeld des Laptops selbst.

```
Desktop, gepinnter Abschnitt (z. B. Projekte)
+------------------------------------------------+
| [Datenblatt Projekt]       .   ( 05 )----+     |
|  Name der Arbeit               Display  \      |
|  Stack (Mono)          ---o-----[ LAPTOP ]     |
|  eine Zeile Text               (04)--Akku      |
|                                     +----------+
|  (einfarbiges Papier, kein Raster)  |Schriftfeld|
+-------------------------------------+----------+
```

- **Schriftfeld** (unten rechts, fixiert, `--paper-hi`, `--line`): Teilenummer, Teilname, Position „3/8“, Sprache.
  Es ist die **Live-Navigation**: zeigt immer das aktive Teil und wechselt beim Scrollen. Am Seitenende wächst es
  zum Kontakt-Schriftfeld (FR-012). Auf dem Handy eine schmale Leiste unten.
- **Stückliste** = Tabelle (Nr., Teil, Abschnitt), füllt sich Zeile für Zeile; Zeilen verlinken zum Abschnitt.
- **Projekt-Datenblätter**: linke Textspalte mit Linie oben (`--line`), Name `--t-h3`, Stack in Mono, ein Satz,
  Links als Text mit Unterstreichung. Keine Karten.
- **Hero**: Name im Format `--t-hero` schmal und schwer, als erstes Bild der zugeklappte Laptop auf dem Papier
  in 3/4-Ansicht. Eine Zeile Beschreibung. Keine Floskeln („Willkommen auf meiner Seite“).

## Bewegung (Tokens)

| Token | Wert | Verwendung |
|---|---|---|
| `--d-micro` | 160ms | Hover, Fokus, Umschalter |
| `--d-ui` | 400ms | Labels ein/aus, Zeilen der Stückliste |
| `--d-line` | 600ms | Beschriftungslinie zeichnet sich (stroke-dashoffset) |
| `--d-intro` | 900ms | **Der eine freie Moment**: Hero-Name per SplitText, Zeile für Zeile, Stagger 40ms |
| `--ease-out` | `power3.out` | Standard |
| `--ease-draw` | `expo.out` | Linien zeichnen |
| scrub | 0,6 | ScrollTrigger-Glättung der Explosion |
| Lenis | `lerp 0.1` | Smooth Scroll |

Alles Scroll-gesteuerte (Explosion, Kamera) ist direkt an den Scrollfortschritt gekoppelt (Scrub) und hat keine
eigenen Zeiten. Außer dem Hero-Intro gibt es **keine** selbstlaufenden Animationen und keine Einblenden-beim-Scrollen-Effekte
für Textblöcke. Reduzierte Bewegung: kein Lenis, kein Scrub, Standbild, Abschnitte untereinander, Linien ohne Zeichnen.

Nur `transform` und `opacity` werden animiert.

## Prinzipien

1. **Die Explosionszeichnung ist die Idee**: Schriftfeld, Positionsnummern, Achsen sind Zeichnungskonventionen
   und tragen Information (Teil, Reihenfolge). Der Hintergrund bleibt eine ruhige, einfarbige Fläche. Nichts davon ist Zierde.
2. **Eine Farbe**: Orange nur für „hier bist du“ und für Zahlen, die zählen.
3. **Daten in Mono, Sprache in Grotesk**: Wer Mono sieht, liest eine Angabe; wer Archivo sieht, liest einen Satz.
4. **Laptop als einzige dunkle Fläche**: Er zieht den Blick, alles andere ist Papier und Tinte.
5. **Ruhig auf dem Handy und ohne 3D**: dieselbe Struktur, Standbild statt Szene.

## Selbstprüfung gegen die Standard-Muster

Geändert nach dem ersten Entwurf (Rückfrage „Würde ich das für jede Seite so machen?“):

- Papier war zuerst `#F4F1EA`-Creme mit Terrakotta → nun graustichiges `#E7E3D8` mit Signalorange `#FF5F1F`
  (Terrakotta/`#D97757` ist ein bekannter KI-Tell). Die Vorgabe „warmes Papier + Orange“ aus der Constitution bleibt erfüllt.
- Mono war als Allzweck-Label-Schrift gedacht → nun nur für echte Daten (Nummern, Maße, Specs).
- Zonenrahmen und Raster entfallen auf Rustams Wunsch (2026-11-08): nur einfarbiger Hintergrund.
- Statt Karten-Raster für Projekte: Linien und Datenblattspalte.

AI-Slop-Liste (Constitution IV):

- [x] keine lila/bunten Verläufe
- [x] keine Glas-Karten, keine Schatten als Dekor, kein einheitlicher Rundungsradius
- [x] keine Emojis als Icons (Linien-SVG oder Text)
- [x] keine generischen Hero-Phrasen
- [x] keine Effekte ohne Bezug zur Idee (jede Bewegung gehört zur Explosion oder zum Zeichnen einer Linie)
- [x] kein Großbuchstaben-Eyebrow über jeder Überschrift, keine „A · B · C“-Metazeilen, keine „→“ an Links
- [x] keine nummerierten 01/02/03-Marker, außer wo es wirklich eine Reihenfolge ist (Teilenummern der Stückliste)
- [x] keine einzelnen Wörter in Überschriften farbig hervorgehoben

## Offen für Rustam

1. Passen Papierton `#E7E3D8` und Signalorange `#FF5F1F`? (Alternativ Orange tiefer `#F25C05`.)
2. Archivo + Martian Mono ok, oder lieber eine schmalere Mono (z. B. Spline Sans Mono)?
3. Schriftfeld als feste Live-Navigation unten rechts: gewünscht?

Kontrast-Werte oben sind gerechnet; T054 prüft sie nach dem Bau noch einmal mit echten Werkzeugen.
