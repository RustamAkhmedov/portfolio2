# Vertrag: Inhaltsdateien in `src/content/`

Felder und Regeln stehen in `../data-model.md`. Geprüft wird das in `tests/content.test.ts`; ein Verstoß
bricht `npm test` ab, und eine fehlende Übersetzung bricht schon `npm run build` ab.

## Beispiele

`parts.json` (Ausschnitt):

```json
[
  {
    "id": "P-01", "key": "lid",
    "name": { "de": "Display", "en": "Display" },
    "spec": { "de": "15,6″ OLED · 2880 × 1620", "en": "15.6″ OLED · 2880 × 1620" },
    "section": "projekte",
    "explode": { "dir": [0, 0.6, -1], "dist": 2.2, "order": 0 }
  }
]
```

`projects.json` (Ausschnitt):

```json
[
  {
    "name": "fretlearn",
    "stack": "JavaScript · PWA · Web Audio",
    "desc": { "de": "…", "en": "…" },
    "thumb": "img/projects/fretlearn.webp",
    "repo": "https://github.com/RustamAkhmedov/fretlearn"
  }
]
```

## Geprüfte Regeln

1. Jeder `{de,en}`-Wert hat beide Sprachen und keine ist leer.
2. Jeder Schlüssel aus `strings.json` wird in einem Template benutzt (keine Leichen).
3. `parts.json`: IDs eindeutig und lückenlos P-01…P-08; jede `section` existiert als `<section id>`;
   `dir` ist nicht der Nullvektor; `dist > 0`.
4. `projects.json`: genau 6 Einträge; `thumb` existiert unter `public/`; `repo` oder `demo` vorhanden, nur https.
5. `contact.json`: `href` ist `mailto:`, https oder eine existierende Datei; `port` aus der erlaubten Liste.
6. Lebenslauf-PDFs je Sprache existieren.
