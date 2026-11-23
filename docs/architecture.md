# Architecture

## Overview

```
apps/web (Preact) ──HTTP /api──┐
        │                      ├── apps/server (Node: http + ws + node:sqlite)
        └────WebSocket /ws─────┘
packages/engine   rules (used on both sides)
packages/board    interactive board (site)
packages/bot      computer opponent (site, in a Web Worker)
packages/protocol shared types and validation
```

All code is TypeScript. The server runs directly with `node src/main.ts` (Node 24 strips the types when loading), so there is no build step on the backend. That is why the server only uses "erasable" syntax (`erasableSyntaxOnly` in the tsconfig): no `enum`, `namespace` or constructor parameter properties.

## Engine (`packages/engine`)

- Immutable position (`Position`): a board of 81 towers, hands, turn, mode, phase (draft or play) and first player.
- `legalMoves(position)` generates the legal moves; `applyMove` applies a move without validating it; `Game` keeps the history and decides the end (mate, repetition, insufficient material).
- Own FEN and move notation (described in `fen.ts` and `notation.ts`), plus the rulebook notation (`4-7-2 侍`).
- `positionProblems(position)` (`validate.ts`) tells why a position set up by hand cannot come from a game: Marshals missing, doubled, in hand, covered or stacked where the mode forbids it, more pieces than the mode has (`pieceLimits`), towers too high, or the side that just moved left in check. The board editor uses it.
- `parseGameRecord(text)` (`record.ts`) reads a game in the export format back, or moves typed by hand in rulebook or machine notation, checking every move. Rulebook notation names no starting square, so it is matched against the legal moves and a move two pieces could make is reported as ambiguous. The analysis imports games with it, entirely in the browser.
- Every rule follows [rules.md](rules.md). The tests cover the examples from the rulebook and the official FAQ, and the 7 Archer images.

## Board (`packages/board`)

A framework-free DOM component, like chessground. It takes the position and the list of legal moves and returns the chosen move. It handles click and drag, the action menu (capture, stack, betray, select), tower inspection, the hand with drops, premoves, animation, check highlight and hover reach. It also shows arrows and painted squares (`shapes`) and reports drawing gestures through `onDraw`: a right-button drag or click, or with `drawMode` taps on the squares; the page decides what each gesture adds or erases. It knows nothing about the network or the clock.

Colors live in CSS variables (`--gg-board`, `--gg-line`, the piece faces and every mark) set on `.gg-wrap` and on `.gg-palette`, a class for pieces and small boards drawn outside the board. A theme is a `gg-theme-<name>` class (`walnut`, `slate`, `contrast`, `custom`; light wood is the default) on the board or any ancestor; the site puts it on the page root from the preferences. Pieces work the same way: `gg-pieces-<name>` recolors faces and ink (`lacquer`, `indigo`, `jade`, the woods `wood`, `cherry`, `bamboo`, and `custom`), `gg-shape-koma` draws them as wooden koma pointing at the opponent (a clipped pseudo-element, so the drop shadow follows the shape), `gg-upright-opponent` keeps the opponent's kanji and letters upright instead of turned toward them (the movement guides and a koma's point still turn, since they show direction; icons always stand upright), `gg-hidden-pieces` (with `gg-peek`) hides what the pieces on the board are, and `--gg-font` sets the kanji typeface. What a piece shows comes from `pieceGlyph` (`kanji`, `illustrated`, `trace` and `letters`, whose abbreviations follow the piece names language). The `custom` theme reads `--gg-custom-*` properties from an ancestor: the site computes them in `apps/web/src/boardColors.ts` from the two colors the player picks, choosing among the built-in themes' mark colors the set that stands out most on that board (by OKLab distance), and warning when lines (WCAG contrast under 3:1), piece faces or marks would be hard to see. `gg-3d` turns on the 3D view, an oblique one as on lichess rather than a perspective: the board is squashed to 82% of its width in height, each disc lies on it squashed by the same 82% with its edge drawn by stacked shadows (drop shadows for the koma), the bottom of its edge centred on its square, and a tower rises from there a disc's thickness per piece. The squares stay rectangles in the grid, so pointing, dragging, the marks and the drawings (an SVG stretched with `preserveAspectRatio="none"`) need nothing else; the hands, the inspector and the small boards stay as seen from above. A board drawn by the page gets the same discs with `gg-stage` and its own `--gg-thick`, `--gg-side` and `--gg-3d-font` (the preview in Settings does). The site turns it on from the board view preference and gives lila's `.main-board` the matching height.

## Server (`apps/server`)

| File | Responsibility |
|---|---|
| `app.ts` | Wires everything: HTTP routes, WebSocket, presence, lobby, friends and leaderboards. |
| `room.ts` | `GameRoom`: one ongoing game. Validates moves and handles the clock, abort, draw, rematch, victory claims and deadlines. |
| `games.ts` | Keeps the rooms, persists to SQLite on every change, updates ratings at the end, reloads ongoing games on restart, and serves the filtered game history. |
| `lobby.ts` | Seeks (with automatic pairing of compatible seeks) and challenge links. |
| `hub.ts` | WebSocket pub/sub by topic (`lobby`, `game:<id>`, `challenge:<id>`). |
| `clock.ts` | Fischer or byo-yomi clock. During the draft the same player may move several times in a row, so the clock goes to "whoever is to move" instead of simply alternating. A byo-yomi clock keeps one number per side, the time until the flag falls (main time plus the periods left), resets the current period after each move, and `byoyomiState` (protocol) splits it back for display. |
| `glicko.ts` | Glicko-2, one rating per game mode. |
| `auth.ts`, `users.ts` | Passwords with scrypt, session cookie `HttpOnly; SameSite=Lax`, session rotation on login. Follows and leaderboard queries. |
| `moderation.ts`, `cli.ts` | Moderators, suspensions, reports and the moderation log; the server command that grants the role (see [moderation.md](moderation.md)). |
| `studies.ts` | Studies and their chapters. A chapter's tree is stored as JSON, checked first by `parseStudyRoot` (protocol), which replays every move with the rules and enforces the limits. |
| `totp.ts`, `two-factor.ts` | Opt-in two-step verification: TOTP codes (RFC 6238 with Node's crypto), the stored secret and the hashed recovery codes. |

### Flow of an online game

1. A creates a challenge (`POST /api/challenges`) or a seek (`POST /api/seeks`). A seek compatible with one already open becomes a game immediately.
2. When the game starts, the server sends `redirect` to both players over WebSocket.
3. Each client subscribes to `game:<id>` and receives the full game view (`GameView`), personalized (`you`, `canAbort`, `canClaimVictory`).
4. Moves go over WebSocket with the move number (`ply`), so stale moves are rejected. The server validates with the engine, updates the clock, persists, and sends the new view to all subscribers.
5. The clock starts after each player's first move. Until then the game can be aborted, and it is aborted automatically if someone does not move in time.
6. If a player stays disconnected from the game for `CLAIM_AFTER_MS`, the other one can claim victory.
7. Correspondence games have no clock: each move sets a deadline (days per move) stored as a date in the `games` table, so it survives restarts unchanged, while a live clock resumes from the time left. The room's timer fires at the deadline (in steps beyond the 24.8 days a `setTimeout` allows). Being away never ends them, and the players get a `turns` message, wherever they are on the site, when a game waits for their move. Their challenges and seeks are stored too (`challenges.ts`, `seeks.ts`), since they wait days for an answer; the other challenges and seeks live in memory.
8. Browser notifications are made by the page itself (`apps/web/src/notify.ts`), from the messages it already receives (`turns`, `incoming`, `redirect` and the game it shows), when the player turned them on and the page is hidden or unfocused. The server does nothing for them, so they need the site open in some tab; notifications with the site closed (web push) would need a service worker and are in the backlog.
9. What a player should learn while away is kept in the `notices` table (`notices.ts`): a new follower, told once per follower, and the moderation decisions about them or about a report they sent, without the moderator or the reason. The latest 50 per player are kept. The `notices` message carries the latest 20 to every socket of the player, on connecting and after each change, and the bell in the header lists them with the challenges and the games waiting for a move; closing the bell marks them as read.

Sending the full view on every change is simpler than sending diffs and solves reconnection for free: on reconnect, the client subscribes again and receives the current state.

### Security

- Writes require `Content-Type: application/json` and an `Origin` equal to the host (or `X-Forwarded-Host`), which blocks forms from other sites.
- WebSocket requires a session and the same origin.
- Session rotation (login, signup, logout) moves anonymous seats, seeks and challenges to the new session id and closes sockets that still hold the old identity.
- Each WebSocket connection may hold up to 32 topics, and only topics that exist can be subscribed.
- Finished games are cached in memory up to 500 (least recently used first out); ongoing games always stay.
- Every request path is wrapped so that no input (malformed percent-encoding in URLs or cookies included) can throw outside the error handler and take the process down.
- Rate limits: 10 login or signup attempts per minute per IP, 20 failed logins per 15 minutes per username (from any IP) and 30 new sessions per minute per IP. The client IP comes from `TRUST_PROXY` (see the README); forwarding headers are ignored unless a proxy is trusted. Limiter windows are dropped once expired.
- Sessions are stored only for writes and `/api/me` (the site's bootstrap call); other reads use a throwaway session. Stored sessions expire after 30 days of inactivity (anonymous) or a year (signed in), and are swept every 6 hours.
- Passwords use scrypt with N=2^14, r=8, p=5 (OWASP's lowest-memory option, 16 MiB per hash). Hashes store their parameters, and older hashes are upgraded on the next successful login.
- Two-step verification (opt-in): TOTP with SHA-1, 6 digits and 30 second steps, one step of drift either way. The time step of the last accepted code is stored, so a code works once. Ten single-use recovery codes (50 random bits each) are stored as SHA-256 hashes, which is enough for random codes of that length. Sign-in stays stateless: the client sends the password again with the code. A setup not confirmed is deleted on Cancel and expires after 30 minutes (removed by the six-hourly sweep). Setting it up and turning it off need the password, and codes typed on the account page count with the failed logins of the account. The QR code is drawn in the browser by `apps/web/src/qr.ts`, so the secret never goes to a third party.
- Moderation: moderators are set only with the server command, never from the site, and cannot act on each other. Every moderator action is logged with its reason. Suspended accounts cannot sign in and lose their sessions at once. Details in [moderation.md](moderation.md).
- Strict CSP on the site: `default-src 'self'`, `connect-src 'self'` (no WebSocket to other hosts), no plugins, no framing.

## Site (`apps/web`)

Preact with its own router and a minimal store (`store.ts`). A single WebSocket with reconnection and per-topic subscription counting (`socket.ts`). The computer opponent runs in a Web Worker so it does not freeze the interface; levels 4 and 5 search with a time budget per move (`SEARCH_LIMITS` in `packages/bot`), using pseudo-legal moves inside the tree, where a move that exposes the own Marshal loses to the capture that follows. Preferences (language, piece names, theme, board theme and custom board colors, piece shape, style, kanji typeface and colors, sound, coordinates, animation) are kept in `localStorage`. The four kanji typefaces are OFL fonts cut down to the 14 piece kanji (a few KB each, in `src/assets/font/kanji`, credited in its README), so the pieces look the same on every device.

### Lessons

`/lessons` teaches the game in eight stages (pieces, towers, pieces in hand, jumping pieces, betrayal, Marshal in danger, mate, draft) of short exercises. The exercises are data with their logic in `packages/protocol/src/lessons.ts`, shared with the server for the progress ids: a position, a goal (reach the starred squares, get out of check, betray a tower, mate in N, place the Marshal, end the draft) and a par, the fewest moves that reach the goal, which earns three stars. Outside mates the opponent does not move, so the player keeps the turn; mate exercises use the mate worker of the puzzles for the defense. A test in `apps/web/test/lessons.test.ts` solves every exercise by breadth-first search and checks its par, so an exercise can never be impossible or score wrong. The board draws the starred squares through its `targets` option. Progress (the best stars of each exercise) is kept on the account (`lesson_progress`), or in `localStorage` without one, and moves to the account on the first signed-in visit.

### Coordinate trainer

`/coordinates` drills the square names in 30 second rounds: find the named square on a board of buttons, or name the lit one by its column and row, in the rulebook's notation or the machine one (the same labels as the board's edge, from `coordinateLabels`). It runs entirely in the browser, and the best scores stay in `localStorage`.

### Practice

`/practice` gives positions to play out against the computer at its strongest level, each with a goal and a move limit: mate, win, or hold on without losing (`packages/protocol/src/practice.ts`, judged by `practiceResult`). The game runs in the browser like the games against the computer, with the bot in its Web Worker. Mates longer than a few moves cannot be proved by the mate search, so `node scripts/practice-check.ts` checks the positions by playing them: the computer takes the player's side one level lower and must reach the goal against the practice opponent; a position it never manages should be changed. Progress (the fewest moves each position took) is kept on the account (`practice_progress`), or in `localStorage` without one. Any valid position of the board editor or the analysis can also be played against the computer, at any level (`/computer?fen=`).

### Puzzles

`/puzzles` offers two kinds of puzzles, with a rating. Mates, in 1 to 3 moves with the tsume convention (every move of the solving side attacks the Marshal, and the defender loses when it has no legal move left), and material wins. The mate search lives in `packages/bot/src/mate.ts` (`mateSolutions`, `isForcedMate`, `longestDefense`); checking moves only keeps it fast enough for the browser.

The puzzles are data, in `packages/protocol/src/puzzle-data.ts`: a position and its solution line. Everything else comes from the line (`puzzleInfo`): the kind, the length, the themes (mate in N, material, capture, drop, stack, betrayal) and the starting rating. `npm run puzzles -- --games 60` (`scripts/puzzles.ts`) makes them: the computer plays games against itself in worker threads. A position with a mate in 1 to 3 that has a single first move becomes a mate puzzle, with the longest defense in between. A position where one move wins material, at least 250 points better than any other at depth 3 and still first at depth 4 (`Searcher.analyse` scores every move), becomes a material puzzle, whose line goes on while the solver keeps a single good move, until the material is won. Puzzles already in the file keep their ids (a hash of the position), and the file is written every few games, so a run can be stopped and resumed.

The page answers moves on the stored line at once; in mates any other mating move is also accepted, checked in a Web Worker (`mate.worker.ts`) that also finds the defense to it. Material puzzles take only the stored line. That loop lives in `puzzleSolver.ts`, shared by the puzzle page and the timed runs. Each player has a puzzle rating apart from the game ratings, and each puzzle has its own: the first try at a puzzle is scored as a game between the two with Glicko-2 (`apps/server/src/puzzles.ts`), and later tries change nothing. The next puzzle is drawn among the closest in rating that the player has not tried. Without an account, solved puzzles stay in `localStorage` and move to the account, as solved without rating, on the first signed-in visit.

`/streak` and `/storm` are timed runs over the same puzzles, as on lichess. Puzzle Streak has no clock and ends at the first wrong move, with one skip; Puzzle Storm gives 3 minutes from the first move, takes 10 seconds off and moves on after a wrong move, and adds time when the combo of correct moves reaches 5, 12, 20, 30 and every 10 after (`stormBonus`). The server draws each run's puzzles along a rising rating curve, every mode mixed (`PuzzleStore.sequence`). Runs never touch the puzzle rating; their scores are kept on the account (`puzzle_runs`) or in `localStorage`, which moves to the account on the first signed-in visit, and the page shows the best of today, of the last 7 days and ever.

### Studies

`/study` lists the public studies and the player's own; `/study/:id` shows one, with its chapters on the side. A chapter starts from a position (a mode's start, a FEN, or a game of the site or an imported one, whose moves become the main line) and holds a tree of moves: the first child of a node continues the main line, the others are variations. Each node has a comment and drawings. The page keeps the tree in memory, edits it with the helpers in `src/studyTree.ts` (add a move, delete from a node, make a line the main one), and saves the whole chapter a moment after each change; the server checks it again (`parseStudyRoot`). The move list is lila's tree view (`StudyMoves.tsx`).

Drawings are the board's shapes, limited to 2 arrows and 4 painted squares per move (`toggleShape`, checked again on the server). Arrows join square centers and squares are painted whole, so nothing is drawn freehand and with so few marks a picture other than an annotation is hard to make. The rest of the safeguards: accounts younger than 7 days cannot publish a public study, studies can be reported (reason `content`), moderators can hide or delete them, the list shows text only, and single studies are kept out of search engines, so an unlisted one never shows up there.

### Draft explorer

`/explorer` shows, for each draft position of the intermediate and advanced modes, what players placed next in finished games and how those games ended. The server (`apps/server/src/explorer.ts`) replays the draft of every ended game that is not voided, not played with a free draft and started by White (games from before White always moved first are left out, since the first player is part of every position), from the mode's start, and counts each position (by FEN) and each move out of it. The index is built per filter (mode, rating band, rated only) on the first query and rebuilt when older than 10 minutes, so the cost grows with the number of games but is paid at most once per filter in that time. The page keeps the path of placements, lets the player step back, and takes a placement from the table or from the board.

### Search engines and link previews

The site is a single-page app, so `scripts/prerender.ts` runs after `vite build`: it renders the public pages (`PAGES` in `src/seo.ts`) with `preact-render-to-string` in each language and writes them to `dist/pages/<lang>/`, together with `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` (the rules specification). Every page has its own title, description, canonical, hreflang, Open Graph tags and, on the home and FAQ, JSON-LD. Other routes (profiles, games) get a shell with the head of their language and an empty body. The app renders over the prerendered markup when it starts.

The server picks the file for each request (`serveStatic` in `apps/server/src/http.ts`): `?lang=<code>` fixes the language (the version search engines index, declared by hreflang), and the plain URL follows `Accept-Language`, as the app follows the browser languages. The server offers the languages the build prerendered (the folders of `dist/pages/`). Page titles and descriptions are in the `seo` section of the locale files; a new public page goes in `PAGES` and gets its texts there.

### Languages

Texts live in `src/i18n/locales/`, one nested JSON file per language, named by its language code (`pt.json` is Brazilian Portuguese). Every message is [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/): plain text, `{name}` arguments, `plural` (Intl plural rules of the language) and `select`, and `<tag>…</tag>` around a part of the text that the code turns into markup (a link, bold). `src/i18n/icu.ts` is a small interpreter for that subset, with no dependency; numbers are written as the code passes them.

`en.json` is the source: its keys give the `Messages` type (TypeScript reads the JSON), so a key the code uses must exist there. `src/i18n/schema.tsx` declares the messages that are not plain text: the arguments of each one in the order the code passes them (the code keeps calling `t.section.key(a, b)`), the tag handlers of rich messages (which return markup) and the lists (one item per line). `test/i18n.test.tsx` checks that the schema and `en.json` agree and that every translation is valid.

`src/i18n/messages.ts` builds a language's `Messages` from its file: each key uses the translation when it is valid ICU with the English text's arguments and tags (and, for lists, as many lines), and falls back to English otherwise, so a language being translated works at any stage. Piece names (`pieces`) come from the files too, and a set where two pieces share a name or letters falls back to English as a whole. English is in the main bundle; the other languages are separate chunks loaded when chosen (`loadLanguage`), and the page waits for its language before the first render, and switches language only once the new one is in (`setLanguage`).

The build offers a language once 80% of its messages are translated (`scripts/languages.ts`, read by `vite.config.ts` into `__LIGUNGI_LANGUAGES__`), listed by its own name. In automatic mode the language comes from the browser (`navigator.languages`, the same tag or else the same base language), with English for the others; `?lang=` in the address fixes it for the tab. The long pages (about, FAQ, contact, friendly sites, terms, privacy and the rule sources) are Markdown files in `src/i18n/content/<lang>/<page>.md`, rendered by `src/i18n/content/markdown.tsx`: `## ` headings, paragraphs, lists, `**bold**`, links and the placeholders `{email}` and `{sources}`. A link names a page of the site or a key of `LINKS`, so the addresses stay in code and a translation cannot add links of its own. A page missing in a language, or with an unknown link or placeholder, shows in English. They load when first shown (or before the first render when the page is opened directly), and the FAQ's questions are its `## ` headings. The date of the terms and privacy policy is `LEGAL_UPDATED`, written in each language by `info.updated`.

Volunteers translate through pull requests for now and on Weblate once the project qualifies for its free plan (see the roadmap). The Weblate component will read `apps/web/src/i18n/locales/*.json` as "JSON nested structure file", with `en.json` as the monolingual base and the template for new languages, the check flags `icu-message-format` and `icu-flags:xml` (for the tags), the language code style "BCP style using hyphen as a separator", and the project language alias `pt:pt_BR`. Each long page will be a component of its own in the "Markdown file" format, with the file mask `apps/web/src/i18n/content/*/<page>.md` and `en/<page>.md` as the base, marking `{email}` and `{sources}` as placeholders. Weblate will commit to the repository, so its changes go through the same checks as any pull request. Piece names follow the interface language or use the Japanese readings. The server sends stable error codes (`packages/protocol/src/errors.ts`) and the site translates them (`errors` in the locale files); the Portuguese message sent along with the code is only a fallback.

## Known limitations

- A single server process: rooms and the lobby live in memory (games are persisted in SQLite). Scaling to several instances would need a broker (Redis, for example), like lichess's lila-ws.
- No password recovery (no email sending).
- The strongest bot levels search only a few moves ahead (alpha-beta with iterative deepening, quiescence on captures and betrayals, within 0.8 s or 2.5 s per move), with no transposition table and no opening knowledge. The page sends the game's earlier positions, and returning to one scores as a draw in the search, so the bot avoids repeating when ahead and seeks it when behind. Below the root only the ten most promising drops are tried, except when the side to move has its Marshal under attack: then every move that saves it is searched, drops included.
- A deploy restarts that single process: a few seconds of downtime, and ongoing games reconnect.
- Prerendered pages show the signed-out header and home until the app loads the session, so signed-in players see it for a moment.
- The server cannot read a language chosen in the settings (it lives in the browser), so a player whose choice differs from the browser language sees the browser language for a moment. The light theme has the same flash: the page starts dark.
- Unknown addresses answer 200 with `noindex` (the client decides what is a 404), not a real 404 status.
- Profiles and games share the site's default title and link preview; only the public pages have their own.
- The link preview image (`og.png`) has English text in every language.
- Performance has not been measured (Lighthouse, Core Web Vitals).
- Player search matches the start of the username only, without typo tolerance.
- An account cannot be deleted while it has an ongoing game (on purpose, but the player has to finish or wait for the game first).
