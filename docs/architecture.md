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
- Every rule follows [rules.md](rules.md). The tests cover the examples from the rulebook and the official FAQ, and the 7 Archer images.

## Board (`packages/board`)

A framework-free DOM component, like chessground. It takes the position and the list of legal moves and returns the chosen move. It handles click and drag, the action menu (capture, stack, betray, select), tower inspection, the hand with drops, premoves, animation, check highlight and hover reach. It knows nothing about the network or the clock.

Colors live in CSS variables (`--gg-board`, `--gg-line`, the piece faces and every mark) set on `.gg-wrap` and on `.gg-palette`, a class for pieces and small boards drawn outside the board. A theme is a `gg-theme-<name>` class (`walnut`, `slate`, `contrast`; light wood is the default) on the board or any ancestor; the site puts it on the page root from the preferences.

## Server (`apps/server`)

| File | Responsibility |
|---|---|
| `app.ts` | Wires everything: HTTP routes, WebSocket, presence, lobby, friends and leaderboards. |
| `room.ts` | `GameRoom`: one ongoing game. Validates moves and handles the clock, abort, draw, rematch, victory claims and deadlines. |
| `games.ts` | Keeps the rooms, persists to SQLite on every change, updates ratings at the end, reloads ongoing games on restart, and serves the filtered game history. |
| `lobby.ts` | Seeks (with automatic pairing of compatible seeks) and challenge links. |
| `hub.ts` | WebSocket pub/sub by topic (`lobby`, `game:<id>`, `challenge:<id>`). |
| `clock.ts` | Fischer clock. During the draft the same player may move several times in a row, so the clock goes to "whoever is to move" instead of simply alternating. |
| `glicko.ts` | Glicko-2, one rating per game mode. |
| `auth.ts`, `users.ts` | Passwords with scrypt, session cookie `HttpOnly; SameSite=Lax`, session rotation on login. Follows and leaderboard queries. |

### Flow of an online game

1. A creates a challenge (`POST /api/challenges`) or a seek (`POST /api/seeks`). A seek compatible with one already open becomes a game immediately.
2. When the game starts, the server sends `redirect` to both players over WebSocket.
3. Each client subscribes to `game:<id>` and receives the full game view (`GameView`), personalized (`you`, `canAbort`, `canClaimVictory`).
4. Moves go over WebSocket with the move number (`ply`), so stale moves are rejected. The server validates with the engine, updates the clock, persists, and sends the new view to all subscribers.
5. The clock starts after each player's first move. Until then the game can be aborted, and it is aborted automatically if someone does not move in time.
6. If a player stays disconnected from the game for `CLAIM_AFTER_MS`, the other one can claim victory.

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
- Strict CSP on the site: `default-src 'self'`, `connect-src 'self'` (no WebSocket to other hosts), no plugins, no framing.

## Site (`apps/web`)

Preact with its own router and a minimal store (`store.ts`). A single WebSocket with reconnection and per-topic subscription counting (`socket.ts`). The computer opponent runs in a Web Worker so it does not freeze the interface; levels 4 and 5 search with a time budget per move (`SEARCH_LIMITS` in `packages/bot`), using pseudo-legal moves inside the tree, where a move that exposes the own Marshal loses to the capture that follows. Preferences (language, piece names, theme, sound, coordinates, animation) are kept in `localStorage`.

### Search engines and link previews

The site is a single-page app, so `scripts/prerender.ts` runs after `vite build`: it renders the public pages (`PAGES` in `src/seo.ts`) with `preact-render-to-string` in each language and writes them to `dist/pages/<lang>/`, together with `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` (the rules specification). Every page has its own title, description, canonical, hreflang, Open Graph tags and, on the home and FAQ, JSON-LD. Other routes (profiles, games) get a shell with the head of their language and an empty body. The app renders over the prerendered markup when it starts.

The server picks the file for each request (`serveStatic` in `apps/server/src/http.ts`): `?lang=pt|en|es` fixes the language (the version search engines index, declared by hreflang), and the plain URL follows `Accept-Language`, as the app follows the browser languages. Page titles and descriptions are in the `seo` section of the dictionaries; a new public page goes in `PAGES` and gets its texts there.

Languages: Portuguese, English and Spanish. Texts live in `src/i18n/`: `pt.tsx` is the source, and `en.tsx` and `es.tsx` share its type (`Messages`), so TypeScript reports any missing key. In automatic mode the language comes from the browser (`navigator.languages`), with English for unsupported languages; `?lang=` in the address fixes it for the tab. Piece names follow the interface language or use the Japanese readings. The server sends stable error codes (`packages/protocol/src/errors.ts`) and the site translates them; the Portuguese message sent along with the code is only a fallback.

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
