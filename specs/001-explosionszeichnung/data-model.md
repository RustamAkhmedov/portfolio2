# Data Model: Portfolio „Explosionszeichnung“

Alle Daten liegen als JSON in `src/content/`. Ein Wert der Form `{ "de": …, "en": … }` wird beim
Rendern in die Seitensprache aufgelöst (Engine aus v1). Schemas als Vertrag: `contracts/content.md`.

## Part (Teil) – `src/content/parts.json`

Wird vom Template (Stückliste, Beschriftungen) **und** von der Szene (Explosion) gelesen. Die Szene
liest nur die Geometrie-Felder, Texte nicht.

| Feld | Typ | Regeln |
|---|---|---|
| `id` | string | `P-01` … `P-08`, eindeutig, Reihenfolge = Stückliste |
| `key` | string | technischer Name, passt zum Objekt in der Szene: `lid`, `board`, `battery`, `ssd`, `ports`, `keyboard`, `fans`, `bottom` |
| `name` | `{de,en}` | z. B. „Display“ / „Display“ |
| `spec` | `{de,en}` | kurze Angabe fürs Label, z. B. „15,6″ OLED · 2880 × 1620“ |
| `section` | string \| null | Anker-ID des Abschnitts (`projekte`, `skills`, `ueber`, `lebenslauf`, `kontakt`) oder `null` |
| `explode.dir` | `[x,y,z]` | Einheitsvektor der Explosionsrichtung (wird normalisiert) |
| `explode.dist` | number | Weg in Szeneneinheiten (1 = 100 mm) bei Explosionsgrad 1 |
| `explode.order` | number | 0…n, Startreihenfolge (Stagger) |

**Zustände eines Teils** (abgeleitet aus `sceneState`, nicht gespeichert):
`assembled` → `exploding` → `exploded` → (`focused` | `ghosted`) → zurück. `focused` = das Teil des
aktuellen Abschnitts (orange, Kamera fährt hin), `ghosted` = alle anderen während eines Abschnitts
(nur Linien).

## SceneState – Laufzeit, `src/scene/state.ts`

| Feld | Typ | Bereich |
|---|---|---|
| `lid` | number | 0 (zu) … 1 (offen, ~110°) |
| `explode` | number | 0 … 1 |
| `focus` | string \| null | `key` des fokussierten Teils |
| `focusMix` | number | 0 … 1 Überblendung ghost/focus |
| `cam` | number | stetiger Index in die Kamera-Keyframes (z. B. 2.4 = zwischen 2 und 3) |
| `screen` | number | Index des Projekts auf dem Display (stetig, für Überblendung) |

Nur die Choreografie schreibt, nur Szene und Overlay lesen.

## Project – `src/content/projects.json`

| Feld | Typ | Regeln |
|---|---|---|
| `name` | string | Pflicht |
| `stack` | string | Pflicht, „·“-getrennt |
| `desc` | `{de,en}` | Pflicht, ≤ 220 Zeichen |
| `thumb` | string | Pfad unter `public/`, Datei MUSS existieren (16:9 oder wird eingepasst) |
| `repo` | string? | https-URL |
| `demo` | string? | https-URL, mindestens eins von `repo`/`demo` |
| `featured` | boolean | `true` = Hauptprojekt (gepinnter Schritt aufs Display), genau 6; sonst Verzeichnis |

Bestand: alle 13 Projekte aus v1. Hauptprojekte (`featured`, in dieser Reihenfolge): gen_Ut, fretlearn,
Weitland, NSCS, OnlineIDE, DrawingTool. Verzeichnis: JDBC-TicketSystem, SpringWeatherWebsite,
SwingShooter2D, Arkanoid, Sudoku, Store, rest_api_project.

## Strings – `src/content/strings.json`

Schlüssel → `{de,en}` oder sprachneutraler Wert (z. B. `skills`-Array). Alle Texte der Seite, inkl.
Steckbrief (`info.*`), Abschnittstitel, Lebenslauf-Pfade (`cv.file`), Meta-Tags.
Regeln: jeder Schlüssel wird benutzt, jeder benutzte Schlüssel existiert, jede Übersetzung ist nicht leer.

## Contact channel – `src/content/contact.json`

| Feld | Typ | Regeln |
|---|---|---|
| `type` | string | `email`, `github`, `cv`, … |
| `label` | `{de,en}` | sichtbarer Text |
| `href` | string | `mailto:` oder https-URL bzw. Pfad |
| `port` | string | Anschluss-Bezeichnung fürs Label: `TB4-1`, `TB4-2`, `HDMI`, `USB-A-1`, `USB-A-2`, `microSD`, `Audio` |

## Site – `src/content/site.json`

Sprachen (`de` → `index.html`, `en` → `en/index.html`), Basis-URL für og-Tags, Pfad zu v1.
