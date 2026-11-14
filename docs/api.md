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
| `GET /api/version` | `{ version, commit }`: the project version and the git commit of the running build. |
| `GET /api/health` | `{ ok: true, version, commit }` after a database query succeeds, `503` otherwise. Meant for uptime monitors. |
| `GET /api/me` | The session's user and their ongoing games. |
| `POST /api/signup` `{ username, password }` | Creates an account and signs in. |
| `POST /api/login` `{ username, password }` | Signs in. |
| `POST /api/logout` | Signs out. |
| `POST /api/account/password` `{ current, next }` | Changes the password (`wrongPassword` when `current` does not match). Signs out every other session and rotates the current one. |
| `POST /api/account/delete` `{ password }` | Deletes the account: ratings, follows and sessions are removed, seeks and challenges cancelled, and finished games keep the moves with the player shown as `Anonymous`. Refused with `409 activeGame` while the player has an ongoing game. Returns `{ user: null }`. |
| `GET /api/account/sessions` | The account's signed-in sessions (`SessionView`), most recently active first: a public handle (never the session secret), whether it is the current one, sign-in and last-use times (to the day) and the browser's user agent. |
| `DELETE /api/account/sessions` | Signs out every other session of the account and closes their sockets. Returns `{ revoked }`. |
| `DELETE /api/account/sessions/:id` | Signs out one other session by its handle (`sessionNotFound` for an unknown handle or the current session). |
| `GET /api/account/settings` | Account settings kept on the server: `{ challengePolicy }`. |
| `POST /api/account/settings` `{ challengePolicy }` | Who may challenge the player from their profile: `everyone` (any signed-in player), `following` (only players they follow) or `nobody` (`invalidChallengePolicy` otherwise). Challenge links are not affected. |
| `GET /api/account/export` | Downloads the account's data as JSON (`Content-Disposition: attachment`): account, settings, ratings, following, followers, sessions (without secrets) and every game with its moves. Up to 5 per minute per account. |
| `GET /api/users?q=<prefix>` | Up to 10 players whose username starts with `prefix` (2 to 20 characters, case-insensitive), alphabetical, each as `{ user, online }`. Any other query returns `[]`. |
| `GET /api/users/:name` | Profile: online status, rating and leaderboard rank per mode, counts, wins, draws and losses of the rated games per mode (`records`), followers, whether the requester follows the player, whether the requester may challenge them (`canChallenge`), ongoing and recent games. |
| `GET /api/users/:name/games` | Finished games, 20 per page, newest first. Optional query filters: `mode`, `result` (`win`, `loss`, `draw`, from the player's point of view), `rated` (`1` or `0`), `color` (`white` or `black`), `vs` (opponent username) and `before` (ms, for paging). An unknown value returns `invalidFilter`. |
| `POST /api/users/:name/follow` | Follows the player (requires an account, up to 400). Returns `{ followed, followers, following }` of the followed player. |
| `DELETE /api/users/:name/follow` | Unfollows. |
| `GET /api/following` | Players the account follows (`FriendView`): online status, ongoing game, ratings and whether the account may challenge them (their challenge setting). Requires an account. |
| `GET /api/players` | The players page (`PlayersView`): signed-in players online (at most 100, free ones first, then by best rating), each with their rating, rated games and leaderboard rank in every mode they played, their current game, whether the viewer follows them and may challenge them; counts (connected browsers, signed-in players online and how many are free, games in progress, games started in the last 24 hours, finished games, accounts); players with rated games per mode in bands of 50 points; and the viewer's own ratings. Counts, bands and ranks are recomputed at most once a minute. |
| `GET /api/leaderboard` | Top 10 of each mode. |
| `GET /api/leaderboard/:mode?limit=<n>` | Top 100 of one mode, or the first `limit` (1 to 100). Only players with an established rating are listed (deviation up to 110, out of the provisional period). |
| `GET /api/ranking/:mode?page=<n>&q=<text>&followed=1` | The ranking page (`RankingView`): one page of 50 rows of the mode's full leaderboard, each with position (ties share it), rating, rated games, wins, draws and losses, online status and whether the viewer follows the player. `q` keeps names containing the text and `followed=1` (signed in) keeps the viewer and the players they follow; `total` counts the matching rows. Also the number of ranked players per mode with the viewer's standing in each, and the viewer's position and page in this mode. Without `:mode`, the viewer's most played mode, otherwise the one with the most ranked players. |
| `GET /api/games/:id` | Full game state (`GameView`). |
| `GET /api/games/:id/export` | The game as text, in the spirit of PGN: headers and one move per line, in both the rulebook and the machine notation. |
| `GET /api/tv` | Ongoing games with at least one move (`GameSummary[]`, at most 24), strongest first by the sum of both ratings. Each summary carries `clock` (milliseconds left for each side and who is running) while the game is in progress, `null` without a clock or once it has ended. |
| `GET /api/lobby` | Open seeks and counters. |
| `POST /api/seeks` (`GameSettings`) | Creates a seek, or returns `{ gameId }` if it pairs immediately. A seek that has to wait needs a live WebSocket from the same session (otherwise `409 connectionRequired`), and it disappears when that connection closes or when the player starts any game. |
| `POST /api/seeks/:id/accept` | Accepts a seek. |
| `DELETE /api/seeks/:id` | Cancels your own seek. |
| `POST /api/challenges` (`GameSettings`, optional `to`) | Creates a challenge link. With `to` (a username) it is a challenge from a profile: only that player can accept it, it needs a signed-in sender with a live WebSocket (`connectionRequired`) and is withdrawn when the sender's last socket closes. Refused with `userNotFound`, `cannotChallengeSelf`, `challengeRefused` (403, the player's policy) or `tooManyChallenges` (429: at most 3 pending sent per player, 10 pending received). |
| `GET /api/challenges/:id` | Challenge state. A challenge stays open for 2 hours; then it becomes `canceled` (watchers get the usual `challenge` message) and is forgotten 2 hours later (`404 challengeNotFound`). |
| `POST /api/challenges/:id/accept` | Accepts the challenge and returns `{ gameId }`. A challenge from a profile answers `403 notYourChallenge` to anyone but its destination. |
| `POST /api/challenges/:id/decline` | The destination declines a challenge from a profile; its status becomes `declined`. |
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
| `{ t: 'takeback', game, action }` | Asks to take back your last move (and the opponent's reply, if they already answered), with the same actions, except that only `accept` answers the opponent's request (asking back is refused, since it would be about another move). Casual games only, never the first two moves (`canTakeback` in the game view); a pending request (`takebackOffer`) is dropped by any move. The time already spent stays spent. |
| `{ t: 'moretime', game }` | Gives the opponent 15 seconds (`EXTRA_TIME_SECONDS`), in any game with a clock (`canGiveTime`). |
| `{ t: 'ping' }` | Answers `pong`. |

Server to client:

| Message | When |
|---|---|
| `{ t: 'game', game }` | Any change in a subscribed game (full state). |
| `{ t: 'lobby', lobby }` | A change in the lobby. |
| `{ t: 'challenge', challenge }` | A change in a subscribed challenge. |
| `{ t: 'incoming', challenges }` | To a signed-in player, on every socket: the open challenges sent to them from profiles. Sent on connecting and after each change. |
| `{ t: 'redirect', path }` | A game of yours started (rematches included). |
| `{ t: 'error', code, message }` | Action refused. After a refused move, the server resends the game state. |
