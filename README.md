# mikzero.github.io

Landing personale di [Mirko Visentin](https://mikzero.github.io)
(`mikzero` su GitHub, `mikvise` su X).

Sito statico: HTML + CSS e un po’ di JavaScript vanilla per
il dither animato sullo sfondo. Nessun build step, nessun tracker.

## GitHub Pages

Il sito è servito da GitHub Pages:

- URL: https://mikzero.github.io
- Branch: `main`
- Cartella: `/` (root del repo)

`index.html` è la homepage. Il file `.nojekyll` dice a Pages di non
passare da Jekyll e di pubblicare i file così come sono.

## File

| File | Ruolo |
| --- | --- |
| `index.html` | Pagina principale |
| `styles.css` | Stile |
| `animate.js` | Dither animato (si ferma con `prefers-reduced-motion`) |
| `favicon.svg` | Icona |
| `404.html` | Pagina non trovata |

## Locale

Apri `index.html` nel browser, oppure servi la root con un server statico.
