# The TUBBZ Archive

**A catalogue of every TUBBZ collectible duck ever released — and a place to keep track of the ones
you own.**

No account. No server. No cookies. Just a static site and your browser.

### → [**thetubbzarchive**](https://pouki-dlb.github.io/thetubbzarchive/)

---

## What are TUBBZ?

TUBBZ are collectible rubber ducks in costume. Each one is an officially licensed character from
film, television, gaming or music, rebuilt as a duck — cape, weapon, scars and all. They come in
four formats: the 9 cm Classic, the 5 cm Mini, the oversized XL, and a plush edition.

## Why this archive exists

Most TUBBZ are produced in limited runs, and many are sold for a limited time only. **When a figure
sells out, its product page usually disappears from the brand's website** — taking its photos,
its description and its release details with it. Arrive a year late and you may never find out a
figure existed at all.

This project tries to keep that record intact: one page per figure, every size, every packaging
variant, photographed and described, whether or not you can still buy it.

The second half is more selfish — if you collect these things, you eventually lose track of what
you already own. So the archive doubles as a collection tracker.

## What you can do here

- **Browse** the whole catalogue, or narrow it down by collection, size, or ownership status.
- **Search** across figure names and collections.
- **Tick off what you own**, packaging by packaging — First Edition and Boxed are tracked
  separately, because collectors care about the difference.
- **See it at a glance**: each card shows one TUBBZ logo per size that figure exists in, in full
  colour when you own it and greyed out when you don't.
- **Keep a wishlist**, version by version — you can want the Classic in its bathtub without
  wanting the Mini boxed — and jot **private notes** on any figure ("paid 15 €", "second copy
  for trade", …).
- **Export and import** your collection as a JSON file, to back it up or move it to another
  device.

## Your data never leaves your browser

Everything you mark is stored in your browser's `localStorage`. There is no account, no database,
no analytics, and nothing is ever sent anywhere.

The flip side is worth stating plainly: **clearing your browsing data will erase your collection**,
and it will not follow you to another browser or device on its own. That is exactly what the
Export button is for — it downloads a small `.json` file you can keep, and Import restores it.

## What's in the archive

At the time of writing:

| | |
|---|---|
| Figures | **491** |
| Collections | **119** |
| Size/packaging variants | **988** |
| Photographs | **1,648** |
| Release years covered | 2019 → 2026 |

Broken down by size: 439 Classic, 217 Mini, 30 Plushies, 12 XL — and 48 variants are known
limited runs, from 1,000 to 3,000 units.

## How it's built

This is a deliberately old-fashioned website, and the constraints are the point:

- **No framework, no build step, no dependencies.** Two HTML pages, three scripts, one stylesheet
  and one data file. What you see in the repo is exactly what runs.
- **No backend.** It's a folder of static files, so it can be hosted for free anywhere. This one
  runs on GitHub Pages, straight from the `main` branch.
- **It runs from `file://`.** Download the repo, double-click `index.html`, and the whole site
  works offline. That's why the catalogue is loaded with `<script src="data.js">` rather than
  `fetch()` — browsers block local file requests, but they'll happily run a local script.
- **Images are found by convention, not by path.** No image URL is ever stored in the data: the
  app derives `images/<id>-<size><packaging>.webp` from the figure's id. A missing file falls back
  to a placeholder without an error.

### Running it locally

```bash
git clone https://github.com/Pouki-dlb/thetubbzarchive.git
cd thetubbzarchive
```

Then either open `index.html` directly in your browser, or serve the folder over HTTP if you
prefer — for example `python -m http.server`. Both work; the second gives you a proper origin,
which makes `localStorage` behave more predictably across browsers.

### Repo layout

| Path | What it is |
|------|------------|
| `index.html` / `index.js` | The grid: search, filters, cards, export/import |
| `duck.html` / `duck.js` | One figure's page: photos per variant, ownership, wishlist, notes |
| `common.js` | Shared logic, `localStorage` handling, the injected header/footer, theme toggle |
| `styles.css` | All styling, responsive, light/dark |
| `data.js` | The catalogue itself — plain JSON assigned to `window.TUBBZ_DATA` |
| `images/` | Figure photographs, 400×400 WebP, named after figure ids |

## Spotted a missing duck?

Gaps are expected — that's the nature of archiving things after the fact. If a figure is missing,
or a photo or release year is wrong, open an issue with the character name and collection.

## A note on ownership

**This is an unofficial, non-commercial fan project.** It is not affiliated with, endorsed by,
sponsored by, or approved by Rubber Road Ltd, Numskull, or Yellow Bulldog Ltd.

TUBBZ® is a registered trademark of Rubber Road Ltd (marketed under the Numskull brand;
tubbz.com is operated by Yellow Bulldog Ltd). All product names, character names, likenesses and
images are the property of their respective owners and are used here for identification and
informational purposes only. No ownership of, or affiliation with, these trademarks or copyrights
is claimed.
