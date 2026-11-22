# Brand images

Sources of the images in `public/` that cannot be SVG (Open Graph previews and app icons need PNG). After changing one, render it again at the size below and replace the PNG.

| Source | Output in `public/` | Size |
|---|---|---|
| `og.svg` | `og.png` | 1200×630 |
| `../src/assets/logo.svg` | `icon-192.png`, `icon-512.png` (transparent) | 192, 512 |
| `../src/assets/logo.svg` | `icon-maskable-512.png` (logo at 60% on `#2b2723`) | 512 |
| `../src/assets/logo.svg` | `apple-touch-icon.png` (logo at 75% on `#2b2723`) | 180 |
| `../public/favicon.svg` | `favicon-32.png` | 32 |

Images for listings outside the site are rendered to the git-ignored `/media` folder at the repository root, since they are only uploaded elsewhere:

| Source | Output in `/media` | Size | Used on |
|---|---|---|---|
| `cover.svg` | `igdb/cover-600x800.png`, `igdb/cover-1200x1600.png` | 600×800, 1200×1600 | IGDB cover |
| `cover-alt.svg` | `igdb/cover-alt-600x800.png` | 600×800 | IGDB alternative cover |
| `cover-square.svg` | `igdb/cover-square-1024x1024.png` | 1024×1024 | IGDB square cover |
| `logo-color.svg` | `igdb/logo-color-1600x480.png` (transparent) | 1600×480 | IGDB game logo (color, for light backgrounds) |
| `logo-white.svg` | `igdb/logo-white-1600x480.png` (transparent) | 1600×480 | IGDB game logo (white) |
| `logo-black.svg` | `igdb/logo-black-1600x480.png` (transparent) | 1600×480 | IGDB game logo (black) |
| `keyart-logo.svg` | `igdb/keyart-logo-1920x1080.png` | 1920×1080 | IGDB key art with logo |
| `keyart.svg` | `igdb/keyart-1920x1080.png` | 1920×1080 | IGDB key art without logo |
| `infographic.svg` | `igdb/infographic-1920x1080.png` | 1920×1080 | IGDB infographic |
| `../public/icon-512.png` | `igdb/icon-512.png` (a copy) | 512 | IGDB icon |
| `discord-banner.svg` | `discord/ligungi-banner-680x240.png` (and `@2x`) | 680×240, 1360×480 | Discord application banner |
| screenshots of ligungi.org (1920×1080, English, cookie notice dismissed) | `igdb/screenshot-*.png` | 1920×1080 | IGDB screenshots |
| `emoji/*.svg` (the pieces with `src/assets/font/kanji/kanji-serif.woff2` loaded as `ligungi kanji serif`; 済み and 新 are not in that subset and come from the system Mincho, Hiragino on macOS) | `discord/emoji/<name>.png` (transparent) | 128×128 | Discord server emojis, named as the file |
| `../src/assets/logo.svg` | `discord/emoji/ligungi.png` (transparent) | 128×128 | Discord server emoji `:ligungi:` |
| `discord-home-banner.svg` (kanji font as for the emojis) | `discord/home-banner-1920x1080.png` | 1920×1080 | Discord Server Home banner (shown cropped to a wide strip, so the pieces sit above the middle) |
| `animated/frames.py` (one SVG per frame, rendered like the emojis above) | `discord/emoji-animated/<name>.gif` (20 fps, 1-bit transparency) and `discord/stickers/<name>.png` (APNG, 15 fps, one shared 256-color palette) | 128×128 (emojis), 320×320 (stickers) | Discord animated emojis (up to 256 KB) and stickers (up to 512 KB) |
| screenshot of the ligungi.org home (English, cookie notice dismissed) | `listings/ligungi-home-1280x800.png` | 1280×800 | websitelaunches.com |

Text uses Noto Sans (SIL Open Font License, bundled in `src/assets/font`).
