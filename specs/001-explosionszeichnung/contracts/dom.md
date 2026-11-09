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
| `button.demo-open[data-demo-open]` | in `[data-step]` (nur Projekte mit `demo`) | „Live-Demo“-Knopf, nur mit `html.choreo.scene-on` sichtbar; `data-demo-url` = https-URL der Demo, `aria-expanded` spiegelt `demoOpen`. Öffnet die Demo-Fahrt (`src/choreo/demo.ts`) |
| `a[data-demo-link]` | neben dem Knopf | normaler Link auf die Demo in neuem Tab; Rückfall ohne 3D/JS/reduzierte Bewegung und auf dem Handy, bei aktiver Choreografie per CSS ausgeblendet |
| `[data-demo-close]` / `#demo-close` | direkt unter `#labels` (vor `.head`) | „Schließen“-Knopf, `hidden` solange die Demo zu ist, bleibt bei offener Demo bedienbar (nicht `inert`) |

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
| `html.demo-on` | Live-Demo offen (`demoOpen`): „Schließen“ sichtbar, restliche Seite (`body`-Kinder außer `#scene`, `#demo-close`, iframe) `inert`, Lenis angehalten |
| `html.demo-dim` | Seite ausgeblendet (opacity 0); bei der Rückfahrt erst ab `demoMix < 0,35` wieder weg |
| `html.demo-zoom` | vom Öffnen bis zum Ende der Rückfahrt: Canvas über das ganze Fenster, Labels aus, Seite nicht scrollbar (`scrollbar-gutter: stable`) |
| `iframe#demo-frame.demo-frame` | entsteht erst beim Öffnen (Kind von `body`), `src` = `data-demo-url`, `title` = „Knopftext: Projektname“; Klassen `.is-open` (offen, sichtbar) / `.is-closing` (Rückfahrt, nicht fokussierbar); Größe und `transform` (`translate` in Ruhe, `matrix3d` in der Fahrt) setzt `src/scene/demo-frame.ts`. Wird beim Schließen entfernt |
| `--scene-left` | CSS-Variable (Desktop): `#scene` und `#labels` beginnen dort, links davon die Textspalte |
| `--labels-side` | CSS-Variable an `#labels`: `1`/`-1` zwingt alle Labels auf eine Seite |

## Seiten-Parameter (nur für Tests/Tools)

| Parameter | Wirkung |
|---|---|
| `?still` | kein Lenis, keine Timeline; Szene fest auf `explode = 1`, `lid = 1`, `cam = 1` (Totale), alle Labels sichtbar, transparenter Hintergrund → Quelle für `public/img/explosion-still.webp` |
| `?state=<json>` | setzt `sceneState` direkt (z. B. `{"explode":0.5}`), für Screenshots einzelner Zustände |
| `?state={"demoMix":1}` | zeigt die Zoom-Pose der Live-Demo (Display füllt den Schirm); `demoMix` 0 … 1 mischt Scroll-Pose → Pose `demo`. Ohne iframe (das entsteht nur durch den Knopf) |

## Test-Hook

`window.__v2` (nur wenn `import.meta.env.DEV` oder `?still`/`?state` gesetzt):
`{ ready: Promise<void>, state: SceneState (inkl. `demoOpen`, `demoMix`), fps(): number, marks?(): Record<string, number> | null }`.
`tools/shot.mjs` wartet auf `ready`. `marks()` (nur mit Choreografie) liefert die Scroll-Marken in px
(`lidEnd`, `explodeEnd`, `projEnd`, `stepsEnd` …) und die Abschnitts-Labels der Master-Timeline (`@hero`, `@projekte-3` …);
`tools/scroll-shot.mjs` scrollt damit durch die Stationen.

## Anker (T053)

`a[href^="#"]` springt mit Choreografie (Lenis) nicht zum DOM-Abstand, sondern zur Scroll-Position aus
`anchorY(marks, id)` (`score.ts`): `hero` 0, `bom` Ende der Explosion, `projekte`/`skills`/`ueber`/`lebenslauf`/`kontakt`
Pin-Beginn, `outro` Seitenende. Unbekannte Ids (`#main`) scrollen zum Element. Danach hat das Ziel Fokus (`tabindex="-1"`),
`history.pushState` setzt den Hash, die Zurück-Taste stellt die gemerkte Position wieder her. `/#id` beim Laden landet an
derselben Stelle. Bei reduzierter Bewegung, ohne WebGL und ohne JS bleiben Anker nativ.

## Sprachen

`<html lang="de|en">`, `<link rel="alternate" hreflang>` auf beide Seiten. Der Sprachumschalter
`a[data-lang-switch]` hängt beim Klick den aktuellen Abschnitts-Anker an (`#projekte` …).

## Live-Demo (T080–T082)

Klick auf `[data-demo-open]` setzt `demoOpen`; `src/choreo/demo.ts` fährt `demoMix` 0 → 1 (1,1 s, `power3.inOut`), legt das iframe an
und übergibt es der Szene (`attach`), die es je Frame deckungsgleich über das projizierte Display legt. Fokus geht ins iframe.
Schließen: Escape (nur wenn das iframe gleiche Herkunft hat oder der Fokus außerhalb liegt), `[data-demo-close]`, Umschalt+Tab aus dem
iframe erreicht „Schließen“. Danach Fokus auf den auslösenden Knopf, `demoMix` 1 → 0, iframe entfernt, Lenis läuft wieder.
Prüfung: `tests/demo.test.ts`, `tests/demo-frame.test.ts`, `npm run shots:demo` (`tools/demo-shot.mjs`). Das Muster `#pattern` (Leiterbahnen)
wurde laut Entscheidung vom 2026-11-09 wieder entfernt und ist kein Hook mehr.
