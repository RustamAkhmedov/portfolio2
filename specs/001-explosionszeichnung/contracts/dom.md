# Vertrag: DOM-Schnittstelle zwischen Markup, Choreografie, Szene und Tests

Diese Hooks sind eine Schnittstelle. Umbenennen nur zusammen mit dem lesenden Code und den Tests.

## Markup → Choreografie

| Hook | Wo | Bedeutung |
|---|---|---|
| `<section id="…" data-part="P-0x">` | `src/sections/*.html` | Abschnitt, gehört zu Teil P-0x; `id` = Anker aus `parts.json` `section` |
| `[data-step]` | in `#projekte` | ein Hauptprojekt-Schritt (6); Reihenfolge = Reihenfolge auf dem Display |
| `.proj-pin` | in `#projekte` | gepinnter Teil: Überspringen-Link, Titel, `.proj-steps` mit den 6 `[data-step]` |
| `#projekte-alle` | in `#projekte` | nicht gepinntes Verzeichnis der übrigen Projekte, Zeilen `[data-project]` |
| `[data-project]` | in `#projekte-alle` | Projektzeile; Fokus/Hover setzt `screen` auf dieses Projekt (nur mit 3D) |
| `a[data-skip="projekte"]` | Anfang von `#projekte` | „Projekte überspringen“ → `#skills` |
| `#hero` | Hero | Pin-Bereich für Aufklappen + Explosion |
| `#bom` | Stückliste | Tabelle, Zeilen `tr[data-part]` mit Link auf den Abschnitt |
| `#outro` | Seitenende | Bereich, in dem sich der Laptop zusammensetzt |

## Szene / Overlay

| Hook | Bedeutung |
|---|---|
| `#scene` | Container des Canvas, `aria-hidden="true"`, `position: fixed` |
| `#scene-fallback` | `<picture>` mit Standbild, sichtbar wenn `html.no-webgl` oder `html.reduced` |
| `#labels` | Overlay, `aria-hidden="true"`; darin `.label[data-part]` (Text aus dem Markup geklont) und ein `<svg>` für die Linien |
| `html.js` / `html.no-webgl` / `html.reduced` | Zustandsklassen, gesetzt vor dem ersten Paint durch ein Inline-Skript im `<head>` |
| `html.intro` | vom Inline-Skript gesetzt (WebGL, keine reduzierte Bewegung, kein `?still`/`?state`): Hero-Name/-Zeile verdeckt bis zum SplitText-Intro, spätestens nach 2,5 s entfernt |
| `html.scene-on` / `html.scene-ready` | Szene läuft / erstes Bild gezeichnet (Canvas blendet ein) |
| `html.choreo` | Scroll-Choreografie aktiv (`choreo/timeline.ts`): Hero füllt den Schirm, Datenblätter liegen übereinander |
| `--scene-left` | CSS-Variable (Desktop): `#scene` und `#labels` beginnen dort, links davon die Textspalte |
| `--labels-side` | CSS-Variable an `#labels`: `1`/`-1` zwingt alle Labels auf eine Seite |

## Seiten-Parameter (nur für Tests/Tools)

| Parameter | Wirkung |
|---|---|
| `?still` | kein Lenis, keine Timeline; Szene fest auf `explode = 1`, alle Labels sichtbar, transparenter Hintergrund → Quelle für `public/img/explosion-still.webp` |
| `?state=<json>` | setzt `sceneState` direkt (z. B. `{"explode":0.5}`), für Screenshots einzelner Zustände |

## Test-Hook

`window.__v2` (nur wenn `import.meta.env.DEV` oder `?still`/`?state` gesetzt):
`{ ready: Promise<void>, state: SceneState, fps(): number, marks?(): Record<string, number> | null }`.
`tools/shot.mjs` wartet auf `ready`. `marks()` (nur mit Choreografie) liefert die Scroll-Marken in px
(`lidEnd`, `explodeEnd`, `projEnd`, `stepsEnd` …) und die Abschnitts-Labels der Master-Timeline (`@hero`, `@projekte-3` …);
`tools/scroll-shot.mjs` scrollt damit durch die Stationen.

## Sprachen

`<html lang="de|en">`, `<link rel="alternate" hreflang>` auf beide Seiten. Der Sprachumschalter
`a[data-lang-switch]` hängt beim Klick den aktuellen Abschnitts-Anker an (`#projekte` …).
