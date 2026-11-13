# Brand images

Sources of the images in `public/` that cannot be SVG (Open Graph previews and app icons need PNG). After changing one, render it again at the size below and replace the PNG.

| Source | Output in `public/` | Size |
|---|---|---|
| `og.svg` | `og.png` | 1200×630 |
| `../src/assets/logo.svg` | `icon-192.png`, `icon-512.png` (transparent) | 192, 512 |
| `../src/assets/logo.svg` | `icon-maskable-512.png` (logo at 60% on `#2b2723`) | 512 |
| `../src/assets/logo.svg` | `apple-touch-icon.png` (logo at 75% on `#2b2723`) | 180 |
| `../public/favicon.svg` | `favicon-32.png` | 32 |

Text uses Noto Sans (SIL Open Font License, bundled in `src/assets/font`).
