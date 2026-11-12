# API

The types of every response and message are in [packages/protocol/src/index.ts](../packages/protocol/src/index.ts).

The session is a `sid` cookie, created by `GET /api/me` or by the first write. Login, signup and logout replace it; anonymous games, seeks and challenges move to the new session, and WebSocket connections opened with the old one are closed with code `4001` so the client reconnects. Writes (`POST`, `DELETE`) need `Content-Type: application/json` (send `{}` even with an empty body) and cannot come from another origin.

## Notation

- Moves: `e3e4` (move), `e3e4=` (stack), `e3e4x` (capture), `Y*e3` (drop from the hand, piece letter in uppercase), `^` plus levels for betrayal (`e3e4=^12`), `done` to declare done in the draft. Squares `a1` to `i9`, with `a1` in White's left corner.
- Piece letters: M Marshal, G General, L Lieutenant General, J Major General, S Samurai, N Lancer, R Knight, Y Ninja, F Fortress, P Soldier, C Cannon, A Archer, K Musketeer, T Tactician. Uppercase for White, lowercase for Black.
- FEN: `<board> <turn> <hands> <mode> <phase> <first>`, described in `packages/engine/src/fen.ts`. A `+` at the end of the phase (`d+`, `p+`) means free draft.

## HTTP

| Method and path | Description |
|---|---|
| `GET /api/me` | The session's user and their ongoing games. |
| `POST /api/signup` `{ username, password }` | Creates an account and signs in. |
| `POST /api/login` `{ username, password }` | Signs in. |
| `POST /api/logout` | Signs out. |
| `GET /api/users/:name` | Profile: online status, rating and leaderboard rank per mode, counts, followers, whether the requester follows the player, ongoing and recent games. |
| `GET /api/users/:name/games` | Finished games, 20 per page, newest first. Optional query filters: `mode`, `result` (`win`, `loss`, `draw`, from the player's point of view), `rated` (`1` or `0`), `color` (`white` or `black`), `vs` (opponent username) and `before` (ms, for paging). An unknown value returns `invalidFilter`. |
| `POST /api/users/:name/follow` | Follows the player (requires an account, up to 400). Returns `{ followed, followers, following }` of the followed player. |
| `DELETE /api/users/:name/follow` | Unfollows. |
| `GET /api/following` | Players the account follows (`FriendView`): online status, ongoing game and ratings. Requires an account. |
| `GET /api/leaderboard` | Top 10 of each mode. |
| `GET /api/leaderboard/:mode` | Top 100 of one mode. Only players with an established rating are listed (deviation up to 110, out of the provisional period). |
| `GET /api/games/:id` | Full game state (`GameView`). |
| `GET /api/games/:id/export` | The game as text, in the spirit of PGN: headers and one move per line, in both the rulebook and the machine notation. |
| `GET /api/tv` | Ongoing games, strongest first. |
| `GET /api/lobby` | Open seeks and counters. |
| `POST /api/seeks` (`GameSettings`) | Creates a seek, or returns `{ gameId }` if it pairs immediately. A seek that has to wait needs a live WebSocket from the same session (otherwise `409 connectionRequired`), and it disappears when that connection closes or when the player starts any game. |
| `POST /api/seeks/:id/accept` | Accepts a seek. |
| `DELETE /api/seeks/:id` | Cancels your own seek. |
| `POST /api/challenges` (`GameSettings`) | Creates a challenge link. |
| `GET /api/challenges/:id` | Challenge state. |
| `POST /api/challenges/:id/accept` | Accepts the challenge and returns `{ gameId }`. |
| `DELETE /api/challenges/:id` | Cancels your own challenge. |

`GameSettings`: `{ mode, rated, timeControl: { initial, increment } | null, color, firstPlayer, freeDraft }`, with `color` and `firstPlayer` in `white`, `black` or `random`. Times in seconds. Games without a clock cannot be rated, and rated games require an account. `freeDraft` (default `false`) makes the draft end only when both players declare done; it applies only to draft modes and is not accepted in rated games. Seeks only pair with seeks that use the same draft rule.

Errors respond with an HTTP status and `{ error, code }`: `code` is a stable code (listed in `packages/protocol/src/errors.ts`) for the client to translate, and `error` is a Portuguese fallback message.

## WebSocket `/ws`

JSON messages. The client subscribes to topics and receives updates.

Client to server:

| Message | Effect |
|---|---|
| `{ t: 'sub', topic }` / `{ t: 'unsub', topic }` | Topics: `lobby`, `game:<id>`, `challenge:<id>`. Subscribing to a game or challenge that does not exist returns an error and subscribes to nothing; a connection holds at most 32 topics (`tooManySubscriptions`). |
| `{ t: 'move', game, move, ply }` | Plays a move. `ply` is the number of moves already played. |
| `{ t: 'resign' \| 'abort' \| 'claim', game }` | Resigns, aborts or claims victory. |
| `{ t: 'draw' \| 'rematch', game, action }` | `action`: `offer`, `accept` or `decline`. |
| `{ t: 'ping' }` | Answers `pong`. |

Server to client:

| Message | When |
|---|---|
| `{ t: 'game', game }` | Any change in a subscribed game (full state). |
| `{ t: 'lobby', lobby }` | A change in the lobby. |
| `{ t: 'challenge', challenge }` | A change in a subscribed challenge. |
| `{ t: 'redirect', path }` | A game of yours started (rematches included). |
| `{ t: 'error', code, message }` | Action refused. After a refused move, the server resends the game state. |
