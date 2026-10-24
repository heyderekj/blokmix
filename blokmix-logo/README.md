# Blokmix logo masters

Final masters for the Blokmix wordmark, app icon and lockups.

- **Wordmarks, flat icons, favicons and lockups:** plain SVG made of filled paths and rectangles. No strokes, fonts, filters or opacity, so they open the same way in Figma, Illustrator, browsers and build tools.
- **The app icon master:** rendered in 3D in Blender.

## App icon: the grab

A glossy pink block grabbed and lifted out of its slot on a dotted canvas.

| File | Use |
|---|---|
| `app-icon/master/blokmix-icon-render-light.png`, `-dark.png` | 1024 px renders with a squircle tile and transparent corners (macOS, marketing, docs) |
| `app-icon/master/blokmix-icon-render-light-square.png`, `-dark-square.png` | 1024 px full-bleed renders (iOS and Android apply their own mask) |
| `app-icon/ios/AppIcon.appiconset/` | Drop into Xcode: 1024 light plus a dark-appearance variant |
| `app-icon/ios/icon-*.png` | Legacy iOS sizes from 20 to 180 px |
| `app-icon/macos/Blokmix.icns` | macOS app icon (Big Sur grid: 824 px artwork with a drop shadow on a 1024 canvas). Built from `Blokmix.iconset/` |
| `app-icon/web/` | `favicon.ico` (16 + 32), `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `avatar-400.png` and `avatar-dark-400.png` for X and Instagram |
| `svg/blokmix-icon-light.svg`, `-dark.svg` | Flat vector icon, for anywhere a vector is needed |
| `svg/blokmix-icon-simple-light.svg`, `-dark.svg` | Flat icon without the dots, for 24–63 px |
| `svg/favicon-16-*.svg`, `favicon-32-*.svg` | Pixel-snapped favicons. Used for the 16 and 32 px macOS sizes too |

## Wordmark and lockups

| File | Use |
|---|---|
| `svg/blokmix-wordmark-ink.svg` | Primary wordmark on light backgrounds |
| `svg/blokmix-wordmark-paper.svg` | Wordmark on dark backgrounds |
| `svg/blokmix-wordmark-on-pink.svg` | Wordmark on hot pink (the block turns ink) |
| `svg/blokmix-wordmark-black.svg`, `-white.svg` | One-color use: stamps, embroidery, single-ink print |
| `svg/blokmix-wordmark-shadow-ink.svg`, `-paper.svg` | Alternate: square o with a hot pink drop shadow, for posters and merch |
| `svg/blokmix-wordmark-square-o-ink.svg` | The square-o alternate without the shadow |
| `svg/blokmix-lockup-horizontal-ink.svg`, `-paper.svg` | Icon plus wordmark, side by side |
| `svg/blokmix-lockup-stacked-ink.svg`, `-paper.svg` | Icon above wordmark |
| `svg/blokmix-x-mark.svg` | Secondary mark: stickers, merch, loading states |
| `png/` | Wordmarks 2000 px wide, and lockups |

In wordmark and lockup file names, `ink` means the version for light backgrounds and `paper` means the version for dark backgrounds. Lockups for light backgrounds use the ink-tile icon, so its silhouette holds against paper.

## Kept for future assets

Nothing from the exploration rounds was deleted.

| Folder | What's in it |
|---|---|
| `explorations/` | Round 2: Block b, Splice, Crossfade, Crossfader and more |
| `explorations-3/` | Round 3: cube, record, dither and other material ideas |
| `explorations-4/` | Round 4: eight canvas moments, plus Zip, Onion skin, Ramp and Halftone. Good candidates for custom product icons |
| `explorations-5/` | Round 5 sketches, including Zip, Gummy and Pinboard |
| `explorations-5/blender/` | Rendered Pinboard (light and dark) |
| `archive/2x2-grid/` | The original 2×2 block icon system: icons, marks, favicons and lockups |

## Construction

- **Wordmark letters**: Archivo at width 125, weight 900, outlined, tracking −45. Kerning: k–m −10, i–x +6.
- **The block**: exactly one x-height square (526 units), sitting on the baseline, with 60 units of space on each side (the same as the l's stem).
- **Icon layout** (1024 canvas):
  - superellipse tile (n = 5)
  - dots every 64 px
  - a 352 px slot carved in at (208, 472)
  - a 392 px block lifted above the canvas, rotated −9° and tilted toward a key light at the top left
- **Rendering**: Blender (Cycles) with the Standard view transform, so the hot pink stays true.
- **Favicons**: redrawn on whole pixels, with no dots and no rotation.

## Rules

- **Clear space**: one block (the wordmark's pink square) on every side.
- **Minimum size**:
  - wordmark: 80 px wide on screen, or 20 mm in print
  - rendered icon: down to 64 px
  - from 24 to 63 px: `icon-simple`
  - 16 and 32 px: the favicons
- **Lockups**: the horizontal icon is the letter height (725 + 12 overshoot) with a half-block gap. The stacked icon is twice the letter height.
- Only the pink block moves in animation. Never recolor it, never set it on pink, and never retype the wordmark in a live font.

## Colors

Hot pink `#FF69B4` (renders and icons use `#FF5CB0` for the lit block) · Ink `#17121A` · Paper `#FBF8F9` · Concrete `#2A2130`

## Rebuilding

| Script | Rebuilds | Notes |
|---|---|---|
| `source/build.py` | Wordmarks | Its old icon and lockup output was the 2×2 system, so don't run it into `svg/` without removing those sections |
| `source/grab_flat.py` | Flat icon, favicons and lockups | Run with `python3 source/grab_flat.py blokmix-logo` |
| `source/blokmix_blender.py` | The renders | `Blender -b -P source/blokmix_blender.py -- OUT grab grab-dark` (add `--square` for full-bleed) |

## Credits

The letterforms are outlined from Archivo by Omnibus-Type, which is licensed under the SIL Open Font License 1.1. The OFL allows artwork made from its outlines, including logos. The block, icon and lockups are original to Blokmix.
