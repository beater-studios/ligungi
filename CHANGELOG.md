# Changelog

Notable changes to ligungi. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). The site and the server share one version, set in the root `package.json`; the footer shows it together with the commit of the build.

## [Unreleased]

### Added

- Takebacks in casual games: ask to take back your last move, and the opponent accepts or declines. Not available in rated games or for the first two moves.
- Give your opponent 15 seconds with the + button on their clock, in any game with a clock.
- Players page (Community > Players), made to find someone to play: how many are online and free, quick game and create game buttons, and the list of signed-in players online with their rating and leaderboard position in the chosen mode, whether they are free or playing, and a Challenge or Watch button. Filters for free players, people you follow and a name search. On the side, the site's numbers and a rating distribution chart that marks where you stand.
- Two stronger computer levels: level 4 thinks up to about 1 second per move and level 5 up to 3 seconds, searching several moves ahead, following captures to the end and avoiding repeating positions when ahead. Levels 1 to 3 are unchanged.
- When you offer a draw or a takeback, a line says it is waiting for your opponent, and another tells you if they decline (also for rematches).

### Changed

- Profile redesigned: a header card with the player's initial, status, follow counts and the Challenge and Follow buttons; one card per mode with rating, leaderboard position and a wins, draws and losses bar; the live game in its own strip; and the game history as rows showing the result, the opponent, how the game ended, the rating change and the date, with mode chips and tabs above. On phones the cards sit two by two and the tabs scroll sideways.
- The first player mark beside a name is now "1st" instead of the kanji 先, and the done button in the draft shows only "Done".
- In games, the rating sits right after the player's name on wide screens too, instead of at the far end of the row.
- Challenge page redesigned: one card that says whether the challenge is for you, by link or to someone; who challenges you with their rating; the mode, time, rated or casual, your colour and who starts as tiles from your side of the board; and Accept and Decline side by side, or the link to copy while you wait.
- Learn page redesigned: a table of contents that follows your reading (chips on phones) beside the sections, each in its own card; the 14 pieces as a grid where picking one loads it in the trainer (the Marshal included), with arrows to go to the previous or next piece and, under the controls, its note and its reach at each tower level; and a new section with the game modes.
- Friends page redesigned, with the community tabs: how many you follow and how many are online, an online-first order, a name search, and per player the status, the rating in every mode and a Challenge (when they accept challenges from you) or Watch button. On phones each row shows the status and the rating of a mode you pick.
- TV redesigned: the strongest game (highest combined rating) is shown large, the others in a grid, each with both players, their ratings and running clocks, and a line with the mode, time control, rated or casual and the move number; a filter by mode and the number of games live next to the title. On phones the smaller games show two per row.
- Play against the computer redesigned: the five levels are cards with a short name (Random, Greedy, Careful, Strong, Strongest) and what each one does; the mode is a switch with its description; your colour and who starts are cards too. On phones the levels stack as rows. During the game the side card shows the level by its short name.
- Game page redesigned: each player row shows an initial in the colour of their pieces, name, rating and whether it is their turn or they are online, with the clock in the same row; the hands sit above and below that card, which stays centred beside the board; the takeback, draw, resign and abort buttons have a label under the icon; and the side card is shorter (mode, time, rated or casual, export). On phones the opponent's row comes first, the hands sit right by the board, and the move navigation buttons are back under the move list.
- Home page redesigned: quick pairing first, with a mode picker (remembered on this device) and, on each time control, how many players are already waiting for it; the create, friend and computer buttons beside it; open games as rows with a Join button; two live games from the TV; and a strip with your own games in progress. The leaderboard box left the home page (the full leaderboard has its own page).
- Leaderboard redesigned: the modes on the side with your rating and position in each, and the full leaderboard of the chosen mode in pages of 50, with wins, draws and losses, who is online, a name search, a filter for the people you follow and a button to jump to your own position. On phones the modes become cards and your position stays at the bottom of the screen.

### Fixed

- Rules: capturing the opponent's Marshal is now always allowed, even when your own Marshal is still attacked afterwards. Right after the draft both Marshals can be under attack, and the capture used to be hidden, which could even end the game as a mate for the player who had the winning move.
- Rules: with only the two Marshals left, the game is no longer a draw when they stand next to each other, because the player to move captures and wins.
- The site header got no background when the page was scrolled, so the content showed through it.
- The piece trainer on the learn page showed two empty grey bars under the board.
- Secondary buttons no longer look see-through on hover in the light theme: they get a tinted background and an outline in both themes.
- The draw confirmation (Offer a draw?) had its buttons out of place, and the answer buttons to an offer did not look like the rest of the game controls.

## [0.2.0] - 2026-11-13

### Added

- Movement indicators: marks around each piece show how it moves (a dot for each square of reach, an arrow for an unlimited line, a ring where jumping pieces land). On by default for new visitors; Preferences has the switch.
- Illustrated piece style: an icon for each piece (crown, rank stars, katana, spear, horse, shuriken, castle, jingasa, cannon, bow, musket, compass), the default for new visitors; players who saved preferences before keep the kanji. The kanji style stays in Preferences, under Piece style, with a live preview. In the illustrated style the piece panel shows the icon, the name and the kanji together, and the opponent's icons stay upright.
- Move notation choice in Preferences: the rulebook's (`3-2-2 槍新`), the same with the piece name (`3-2-2 +Lancer`, with `+` for a piece from the hand, `×` capture and `⇄` betrayal; the default for new visitors) or the machine notation used in exports, which also switches the board coordinates to letters and numbers (`a1` to `i9`).
- Challenge a player from their profile: the Challenge button opens the usual game settings and the player gets the challenge right away in a new challenges menu in the header (with a sound), where they can accept or decline. The challenge is withdrawn if you leave the site. The Account page sets who may challenge you: anyone, only players you follow, or nobody.
- Board themes in Preferences: light wood, dark wood, gray and high contrast. High contrast uses blue and yellow for the move marks, easier to tell apart with color blindness or low vision. The theme also applies to the small boards (TV, learn page) and the tower panel.
- A "New to Gungi?" box beside the board in your first games, to switch the illustrated pieces, the movement indicators and the reach on hover, with a link to the rules.

### Changed

- Preferences page redesigned: settings grouped (General, Board appearance, Game record, Board), each with a short explanation and switches for on/off options. The board appearance settings (theme, piece style, movement indicators, coordinates) show a corner of the board and the record settings a sample move list, both updating as you change them. Board size links to the board to see it.
- Showing a piece's reach on hover is now on by default for new visitors.
- The privacy policy now mentions the challenge setting kept with the account, and the data download includes it.
- Profile header reorganized: Follow and Challenge beside the name, and member since and follow counts on one line below with the head-to-head link.

### Fixed

- Pages with a side menu (profile, account, ranking, friends, TV, info pages) kept changing width with their content, for example when switching the profile tabs.
- Challenge links older than 2 hours could still be accepted, or not, depending on whether someone else had created a challenge in the meantime. They now always expire after 2 hours, and the page says the challenge was canceled.
- In games and analysis, White's pieces in hand (beside the board) had no disc color and looked black on the dark theme.
- Board coordinates could disappear where they overlapped a piece of the same shade; they now have a halo in the board color.
- The red glow on a Marshal in check was hidden almost entirely under the piece; it now shows around it.
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

[Unreleased]: https://github.com/beater-studios/ligungi/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/beater-studios/ligungi/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/beater-studios/ligungi/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/beater-studios/ligungi/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/beater-studios/ligungi/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/beater-studios/ligungi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/beater-studios/ligungi/releases/tag/v0.1.0
