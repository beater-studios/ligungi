# Backlog

Candidate work for ligungi: ideas, gaps and features seen on other lila-based sites. Nothing here is committed to. Items that are confirmed move to [roadmap.md](roadmap.md).

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more), **XL** (research project). Priority is a proposal, to be revisited. "Seen on" names the site where the feature was observed: [lichess](https://lichess.org/), [lidraughts](https://lidraughts.org/), [libaduk](https://libaduk.com/), [lishogi](https://lishogi.org/) or internal (found while building ligungi).

## Accounts, moderation and policies

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Password recovery by email | Needs an outgoing email service | M | Medium | lichess, internal, lishogi |
| Captcha instead of the per-username login lockout | Today 20 wrong passwords lock an account for 15 minutes, which an attacker can abuse | M | Low | internal |

## Operations

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Several server processes (message broker) | Only needed with many concurrent players | L | Low | internal |

## Play

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Stronger computer through self-play tuning: a script makes the bot play thousands of games against itself on a developer machine, fits the weights of its hand-made evaluation (piece values, tier, hand and position bonuses in `packages/bot/src/search.ts`) to the results (Texel tuning), and keeps a new set only if it beats the current one by a clear margin over hundreds of games | Levels 4 and 5 get stronger without waiting for human games: on 2026-11-25 production had 31 finished games, far too few to tune on, and games against the computer are not stored. Human games can join the data once there are thousands, with a draft opening book | M | Medium | internal |
| Kyu and dan ranks derived from the rating, shown beside names | Japanese-game flavor; easier to read than a number | S | Medium | lishogi |
| Speed categories on quick pairing (Bullet, Blitz, Rapid, Classical) | lichess convention, easier to read than raw times | S | Low | lichess, lidraughts, libaduk |
| Computer presets on quick pairing (play the bot at each level in one click) | Shortcut for the most common solo game | S | Low | lichess, lishogi |
| Rating range filter for seeks | Find opponents of similar strength | S | Low | lichess, lishogi |
| Bot accounts through a bot API (engines play on the site, list of online bots) | Lets engine authors join, gives players more opponents | L | Low | lichess, lishogi |
| Simultaneous exhibitions | Strong players against many at once | L | Low | lichess, lidraughts, lishogi |
| Queued draft placements: during the draft a player programs several placements (and the done declaration), and the server plays the next one the moment their turn comes, even with them away | A correspondence draft can take days, one placement per turn. Within the rulebook: the draft stays alternating and in the open, and a player who queues only gives up reacting to the opponent's next placements (like lichess's conditional premoves in correspondence), so rated games can use it. If the draft ends first (the second player's done), the rest of the queue is dropped. The queue lives on the server so it plays while the player is away | M | Medium | lichess |
| Blind draft (casual option): each player builds their whole draft without seeing the other's, and both are shown once both confirm | Speeds up the draft, mostly in correspondence. A variant, not the rulebook: no reacting to the other's placements, and the second player's done no longer ends the draft (it plays like the free draft). Casual only, like the free draft, and recorded in section 7.1 and 11 of rules.md. The starting territories never touch, so the two drafts can be merged into an ordinary free draft record (placements interleaved), and replay, analysis and export keep working | M | Low | internal |
| Draft variants (casual option): who moves first after the draft (the first player as today, whoever finished first, whoever finished last, or the second player), with or without the second player's cut, and a full placement draft where both players must place all 25 pieces before the game starts | Suggested by players from the gungi.io community, who listed seven variations; the rulebook one is the rated rule and the "no cut, first player starts" one is the free draft. The full placement draft was suggested later by the same players: no one declares done with pieces in hand, so the game starts with empty hands and drops play no part (captured pieces leave the game). None of the others is in the rulebook, so casual only, like the free draft, recorded in section 7.1 and 11 of rules.md. Needs the first mover stored apart from the first player (engine, FEN, records), a single choice when creating a game rather than seven rules, and the draft explorer to leave these games out | M | Low | internal |
| First player drawn at random (casual option): Black may start, as in the rulebook, where the first player is drawn whatever the colors | Asked by players who miss seeing Black start. Rated games keep White first (section 11, item 9 of rules.md): it is the convention of the other board games and keeps one convention for training our own engine. The engine, FEN and records already accept Black as first player; it needs the choice when creating a casual game, and the draft explorer already leaves out games Black started | S | Low | internal |
| Declare done together with the last placement, besides as a turn of its own | Suggested by a player, as gungi.io does it. Changes every game, rated included: the second player's cut would come with their last placement, one tempo earlier than now. The rulebook and 軍儀Web do not say which (rules.md section 11, item 12), so it needs a source or a maintainer decision first | S | Low | internal |
| Partial betrayal (casual option): when the Tactician betrays, the player chooses which enemy pieces of the tower to swap, instead of all of them | Asked by a player used to gungi.io, who would like both rules on offer while agreeing the rulebook one stays. Rated games keep all or nothing (rules.md section 6 and section 11, item 3): the rulebook and FAQ only say betraying is optional, 軍儀Web says every enemy piece is swapped, and partial swaps only appear as speculation on a blog, so this is a variant, recorded as such. Needs the option stored with the game (engine, FEN, records, as the free draft), move generation offering each subset of swappable pieces, a way to pick them in the board's action menu, notation for a partial swap, and the draft explorer leaving these games out. The player says the case rarely comes up | M | Low | internal |

## Watch

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| TV channel for games against the computer | Something to watch even when few people play. Games against the computer run in the browser, so the server never sees them; it needs bots that play on the server, as with bot accounts | S | Low | lishogi |
| Twitch stream: Chat against the Computer, with Gungi TV in between | Puts Gungi where people watch games and brings viewers to the site, with no one needed on camera (the channel exists: `LINKS.twitch`). **Chat against the Computer**, in the spirit of "Twitch Plays Pokémon": a real game on the site between a "Twitch Chat" account and the computer, the chat voting each move in the notation of the typed moves (anything that is not a valid move is ignored). The timer (about 30 seconds) starts with the first valid vote; one vote per viewer per round, the last one counts; moves written differently but equal count together; the most voted move is played and a tie is drawn at random. A game left with no votes for about 5 minutes is lost and a new one starts. `!resign` needs a clear majority (about 70%); the computer's level rises when the chat wins and drops when it loses, as a campaign. Beginner mode first (no draft); draft modes need rules of their own. Only followers or accounts a few days old vote, with a message limit per viewer. On screen: the board, the live vote tally (top moves with bars), the timer and the moves. **In between**: the best live game of the site, as `/tv`; when there is none, the computer against itself with the evaluation bar; or a puzzle the chat races to solve, with points on a stream leaderboard. **How**: a separate process reads the chat, counts the votes and plays through the site (the bot already runs in Node). The picture could come from the site in a headless browser, but a lighter renderer drawing the board straight to video (no browser) is worth trying first. Encoding video uses a core or two all the time, so it should not run on the site's server: another machine, or the maintainer's own, at 720p and 10 to 15 frames per second. Twitch credentials stay out of the repository. Check Twitch's current policy on automated 24-hour streams first | L | Low | internal |

## Community

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Official social media: X, YouTube, Twitch and Instagram, each linked from the footer with its icon (icons from Simple Icons, CC0) | Follow news and see the game played; the Discord server already exists ([discord.ligungi.org](https://discord.ligungi.org)) | S | Medium | lichess, lishogi |
| Community links in the menu and footer (GitHub issues, community group, social media) | The issue tracker is only linked from the FAQ and contact page | S | Medium | lichess, libaduk, lishogi |
| Private messages, with a setting for who can message me | Players can only reach each other through a challenge today; moderation tools and reports now exist, and the account page already has who can challenge and who can follow | M | Medium | lichess |
| User blogs | Community content | M | Low | lichess |
| Chat in games, on TV and a site chat room | Social core of lichess. Moderation tools and reports now exist | M | Medium | lichess, lidraughts, libaduk, lishogi |
| Teams, forum and blog | Community spaces | L | Low | lichess, lidraughts, lishogi |

## Tools

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Puzzles made by players: pick a position from a game or the editor, enter the solution, and publish it after a check (for mates, the engine confirms the solution is the only one) | Asked by a player who has games worth turning into puzzles; more variety than the generated set. Needs the check, moderation and reports like studies, and a way to rate them. Meanwhile studies can hold a position and its solution | M | Medium | internal |
| Computer analysis in the browser (evaluation, best line, mistakes in a finished game) | Core study tool on lichess-style sites. Needs a stronger engine | L | Medium | lichess, lishogi |
| Learn from your mistakes: replay the critical moments of your own games | The most loved study feature on lichess. Needs the computer analysis | M | Medium | lichess |

## Platform

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Public API with personal tokens (and OAuth for third-party apps) | Lets the community build tools, bots and integrations | L | Medium | lichess |
| Donations or patrons | Funding, if wanted | S | Low | lichess, lidraughts, lishogi |
| Web push notifications with the site closed (correspondence turns, challenges) | Correspondence games last days, and today the turn notice (in the bell or as a browser notification) needs the site open in some tab. Needs a service worker, VAPID keys, a table of subscriptions and the server sending the messages (with `node:crypto`, or the `web-push` package, which would be a new dependency) | M | Medium | lichess |

## Code

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Split `packages/board/src/board.ts` (775 lines, one class doing state, input, interaction rules, drawing and animation): the HTML of pieces, towers and square titles into `render.ts`, the SVG of arrows and painted squares into `shapes.ts`, leaving the class with its state, input and coordination | Easier to find and change each part. Not a cut and paste: the class keeps its state in private fields, so each part that moves becomes a function taking what it read from `this`. The board tests cover behavior but not looks (arrows, the 3D view, animations), so it needs a check in the browser in both themes and orientations. Best done together with the next change to the board, which opens and checks it anyway | M | Low | internal |
