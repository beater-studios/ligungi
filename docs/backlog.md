# Backlog

Candidate work for ligungi: ideas, gaps and features seen on other lila-based sites. Nothing here is committed to. Items that are confirmed move to [roadmap.md](roadmap.md).

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more), **XL** (research project). Priority is a proposal, to be revisited. "Seen on" names the site where the feature was observed: [lichess](https://lichess.org/), [lidraughts](https://lidraughts.org/), [libaduk](https://libaduk.com/), [lishogi](https://lishogi.org/) or internal (found while building ligungi).

## Accounts, moderation and policies

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Password recovery by email | Needs an outgoing email service | M | Medium | lichess, internal, lishogi |
| Captcha instead of the per-username login lockout | Today 20 wrong passwords lock an account for 15 minutes, which an attacker can abuse | M | Low | internal |
| Block a player: no challenges, follows, pairing in the lobby or (once they exist) messages and chat from them, managed from their profile and a list in the account | Reports reach the moderators, but a player has no way to stop one person on their own; the privacy settings only limit everyone at once. Close to required once chat or messages come, and it would change the Microsoft Store age rating answers (IARC), so the questionnaire is answered again | M | Medium | lichess |

## Operations

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Several server processes (message broker) | Only needed with many concurrent players | L | Low | internal |

## Play

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Kyu and dan ranks derived from the rating, shown beside names | Japanese-game flavor; easier to read than a number | S | Medium | lishogi |
| Speed categories on quick pairing (Bullet, Blitz, Rapid, Classical) | lichess convention, easier to read than raw times | S | Low | lichess, lidraughts, libaduk |
| Computer presets on quick pairing (play the bot at each level in one click) | Shortcut for the most common solo game | S | Low | lichess, lishogi |
| Rating range filter for seeks | Find opponents of similar strength | S | Low | lichess, lishogi |
| Keyboard move input | Speed and accessibility | M | Low | lichess |
| Zen mode (hide everything but the board and clocks) | Focus while playing | S | Low | lichess |
| Bot accounts through a bot API (engines play on the site, list of online bots) | Lets engine authors join, gives players more opponents | L | Low | lichess, lishogi |
| Simultaneous exhibitions | Strong players against many at once | L | Low | lichess, lidraughts, lishogi |
| Queued draft placements: during the draft a player programs several placements (and the done declaration), and the server plays the next one the moment their turn comes, even with them away | A correspondence draft can take days, one placement per turn. Within the rulebook: the draft stays alternating and in the open, and a player who queues only gives up reacting to the opponent's next placements (like lichess's conditional premoves in correspondence), so rated games can use it. If the draft ends first (the second player's done), the rest of the queue is dropped. The queue lives on the server so it plays while the player is away | M | Medium | lichess |
| Blind draft (casual option): each player builds their whole draft without seeing the other's, and both are shown once both confirm | Speeds up the draft, mostly in correspondence. A variant, not the rulebook: no reacting to the other's placements, and the second player's done no longer ends the draft (it plays like the free draft). Casual only, like the free draft, and recorded in section 7.1 and 11 of rules.md. The starting territories never touch, so the two drafts can be merged into an ordinary free draft record (placements interleaved), and replay, analysis and export keep working | M | Low | internal |
| Draft variants (casual option): who moves first after the draft (the first player as today, whoever finished first, whoever finished last, or the second player), with or without the second player's cut, and a full placement draft where both players must place all 25 pieces before the game starts | Suggested by players from the gungi.io community, who listed seven variations; the rulebook one is the rated rule and the "no cut, first player starts" one is the free draft. The full placement draft was suggested later by the same players: no one declares done with pieces in hand, so the game starts with empty hands and drops play no part (captured pieces leave the game). None of the others is in the rulebook, so casual only, like the free draft, recorded in section 7.1 and 11 of rules.md. Needs the first mover stored apart from the first player (engine, FEN, records), a single choice when creating a game rather than seven rules, and the draft explorer to leave these games out | M | Low | internal |
| First player drawn at random (casual option): Black may start, as in the rulebook, where the first player is drawn whatever the colors | Asked by players who miss seeing Black start. Rated games keep White first (section 11, item 9 of rules.md): it is the convention of the other board games and keeps one convention for training our own engine. The engine, FEN and records already accept Black as first player; it needs the choice when creating a casual game, and the draft explorer already leaves out games Black started | S | Low | internal |
| Declare done together with the last placement, besides as a turn of its own | Suggested by a player, as gungi.io does it. Changes every game, rated included: the second player's cut would come with their last placement, one tempo earlier than now. The rulebook and 軍儀Web do not say which (rules.md section 11, item 12), so it needs a source or a maintainer decision first | S | Low | internal |

## Watch

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| TV channel for games against the computer | Something to watch even when few people play. Games against the computer run in the browser, so the server never sees them; it needs bots that play on the server, as with bot accounts | S | Low | lishogi |

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
| ligungi as a Discord Activity: the site running inside Discord, in a voice channel, with friends playing or watching | Plays where the community already is, and shows "Playing ligungi" by itself. Needs the Discord account link first (the login inside Discord is Discord's OAuth2), every request through Discord's proxy (`<id>.discordsays.com`, WebSocket included, external resources such as analytics blocked), a layout for the iframe and games between the people of the call. The public launch and review rules were not documented where we looked | L | Low | internal |
| Web push notifications with the site closed (correspondence turns, challenges) | Correspondence games last days, and today the turn notice (in the bell or as a browser notification) needs the site open in some tab. Needs a service worker, VAPID keys, a table of subscriptions and the server sending the messages (with `node:crypto`, or the `web-push` package, which would be a new dependency) | M | Medium | lichess |
| Play the computer offline: the installed app, or a page opened before, keeps working without internet for games against the computer, the lessons and the analysis board | The engine and the bot already run in the browser, so only the server-backed parts (online games, puzzles, accounts) need the network. Needs the service worker to cache the app's files (the hashed bundles under `/assets/`, the HTML shell, fonts and sounds) and to update them on a deploy without serving stale code, plus a way to show which parts work offline. Today the worker only shows a "no connection" page (see "Installing and losing the connection" in architecture.md) | M | Medium | internal |
