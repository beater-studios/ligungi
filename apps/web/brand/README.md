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
| `keyart-logo.svg` (rendered at 1280×720, cropped 40 px at the top and bottom) | `github/social-preview-1280x640.png` | 1280×640 | GitHub social preview (Settings > General > Social preview, uploaded by hand) |
| `keyart-logo.svg` (rendered at 1351×760, cropped 40 px at the left and right) | `producthunt/gallery-1-cover-1270x760.png` | 1270×760 | Product Hunt gallery cover |
| `igdb/screenshot-*.png` cropped, with a title and subtitle over lila's dark background (rendered from HTML) | `producthunt/gallery-2-towers` to `gallery-6-pieces` (`-1270x760.png`) | 1270×760 | Product Hunt gallery |
| `../src/assets/logo.svg` (at 75% on `#2b2723`) | `producthunt/thumbnail-240x240.png` | 240×240 | Product Hunt thumbnail |
| screenshot of the ligungi.org home (English, cookie notice dismissed) | `listings/ligungi-home-1280x800.png` | 1280×800 | websitelaunches.com |
| `x-banner.svg` | `x/banner-1500x500.png` | 1500×500 | X header (the profile picture covers the bottom left corner, so the text starts in the middle) |
| `../src/assets/logo.svg` (at 75% on a radial `#6a6158` to `#4a443e`, so the black tier stands out) | `x/profile-400.png`, `instagram/profile-400.png` | 400×400 | X and Instagram profile picture |
| `igdb/keyart-logo-1920x1080.png` and boards captured from ligungi.org (1280 wide at 2x, English, dark theme), with a title over the dark background (rendered from HTML) | `instagram/post1-slide1` to `post1-slide5` (`-1080x1350.png`) | 1080×1350 | Instagram first carousel |

Text uses Noto Sans, bundled in `src/assets/font` (license in its [README](../src/assets/font/README.md)).

## License

The images in this folder, the logo (`../src/assets/logo.svg`), the PNGs rendered from them and the screenshots of the site in `../public/screenshots` are original work by Beater Studios, under the license of ligungi (AGPL-3.0-or-later, see [LICENSE](../../../LICENSE)).
