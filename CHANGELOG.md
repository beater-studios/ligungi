# Changelog

Notable changes to ligungi. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). The site and the server share one version, set in the root `package.json`; the footer shows it together with the commit of the build.

## [Unreleased]

### Added

- Movement indicators: marks around each piece show how it moves (a dot for each square of reach, an arrow for an unlimited line, a ring where jumping pieces land). On by default for new visitors; Preferences has the switch.
- Illustrated piece style: an icon for each piece (crown, rank stars, katana, spear, horse, shuriken, castle, jingasa, cannon, bow, musket, compass), the default for new visitors; players who saved preferences before keep the kanji. The kanji style stays in Preferences, under Piece style, with a live preview. In the illustrated style the piece panel shows the icon, the name and the kanji together, and the opponent's icons stay upright.
- Move notation choice in Preferences: the rulebook's (`3-2-2 槍新`), the same with the piece name (`3-2-2 +Lancer`, with `+` for a piece from the hand, `×` capture and `⇄` betrayal; the default for new visitors) or the machine notation used in exports.
- Challenge a player from their profile: the Challenge button opens the usual game settings and the player gets the challenge right away in a new challenges menu in the header (with a sound), where they can accept or decline. The challenge is withdrawn if you leave the site. The Account page sets who may challenge you: anyone, only players you follow, or nobody.
- A "New to Gungi?" box beside the board in your first games, to switch the illustrated pieces, the movement indicators and the reach on hover, with a link to the rules.

### Changed

- Preferences page redesigned: settings grouped (General, Pieces on the board, Game record, Board), each with a short explanation and switches for on/off options. The piece settings show a corner of the board and the record settings a sample move list, both updating as you change them. Board size links to the board to see it.
- Showing a piece's reach on hover is now on by default for new visitors.
- The privacy policy now mentions the challenge setting kept with the account, and the data download includes it.
- Profile header reorganized: Follow and Challenge beside the name, and member since and follow counts on one line below with the head-to-head link.

### Fixed

- Pages with a side menu (profile, account, ranking, friends, TV, info pages) kept changing width with their content, for example when switching the profile tabs.
- On phones, the ratings at the top of a profile showed only the numbers, without the mode names, above a tall empty band.

## [0.1.4] - 2026-11-13

### Added

- Account page: see the devices where your account is signed in and sign out one or all of the others.
- Account page: download a copy of your data (profile, ratings, follows, sessions and all your games) as JSON.

### Changed

- New site footer, the same on every page including the home: the brand, links grouped into Site, Play and Code and legal, and the legal notice with the version.
- Build tooling upgraded to Vite 8 and TypeScript 7, and the server image to Node 24.22.2.
- The privacy policy now says that each signed-in session keeps the browser's description and its sign-in and last-use dates, and lists what you can do yourself on the Account page.

## [0.1.3] - 2026-11-13

### Added

- Search engines, AI assistants and link previews now see the real content: public pages are prerendered in Portuguese, English and Spanish, each with its own title, description, canonical address, language alternates (`?lang=`), Open Graph image and structured data.
- `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` (the full rules specification).
- The site can be installed as an app (web manifest and icons).
- While your game waits in the lobby, the home shows it with a cancel button instead of the quick pairing grid.
- Link to the public status page in the footer and on the home.

### Changed

- Cancelling your game in the lobby asks for confirmation.
- `?lang=pt`, `?lang=en` or `?lang=es` in the address sets the language for the tab.

## [0.1.2] - 2026-11-12

### Added

- Account page (from the user menu or the settings page): change the password, which signs out the other devices, and delete the account. Finished games stay in the history as "Anonymous".
- Player search in the header.
- `GET /api/health` for uptime monitoring.

### Changed

- Empty required form fields are no longer outlined in red before the user types in them.

### Fixed

- Icons of the analysis board controls were drawn below the center of their buttons.

### Security

- Test tooling upgraded to vitest 5.1.0, clearing the advisories in vitest, tinypool and @vitest/mocker (development only; production dependencies were not affected).

## [0.1.1] - 2026-11-12

### Added

- About, FAQ, contact, terms of service and privacy policy pages, in the three languages, linked from the home and the footer.
- Rule sources on the learn page.
- Leaderboard and featured game boxes on the home page.
- Optional Cloudflare Web Analytics (no cookies), loaded only after the visitor accepts it in a cookie notice; the choice can be changed on the privacy page.

### Changed

- Home counters stacked under the game buttons, and ligungi's logo faded behind the quick game grid, as on lichess.
- Pages are sent with `Cache-Control: no-transform`, so a CDN cannot inject scripts (such as analytics) before the visitor consents.

## [0.1.0] - 2026-11-12

First public version.

### Added

- Rules engine for the official 2022 Gungi rules (all four modes, draft, towers, drops, betrayal), with the specification in `docs/rules.md`.
- Online play in real time: lobby with automatic pairing, challenge links, clocks with increment, draw offers, rematch, abort and victory claims.
- Optional accounts with Glicko-2 ratings per mode, leaderboards, following players and profiles with a filterable game history.
- Play against the computer, analysis board, live games and a rules page with an interactive piece trainer.
- Interface in Portuguese, English and Spanish.
- Lichess-based look (lila's styles), shared form components and a design system page at `/design`.

[Unreleased]: https://github.com/beater-studios/ligungi/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/beater-studios/ligungi/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/beater-studios/ligungi/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/beater-studios/ligungi/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/beater-studios/ligungi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/beater-studios/ligungi/releases/tag/v0.1.0
