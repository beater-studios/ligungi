# Backlog

Candidate work for ligungi: ideas, gaps and features seen on other lila-based sites. Nothing here is committed to. Items that are confirmed move to [roadmap.md](roadmap.md).

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more), **XL** (research project). Priority is a proposal, to be revisited. "Seen on" names the site where the feature was observed: [lichess](https://lichess.org/), [lidraughts](https://lidraughts.org/), [libaduk](https://libaduk.com/), [lishogi](https://lishogi.org/) or internal (found while building ligungi).

## Accounts, moderation and policies

The first item closes a gap between what the terms promise and what the site can do today.

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Moderation tools: suspend or ban accounts, rename offensive usernames, void games won by cheating, user reports | The terms say accounts may be suspended, but there is no tool to do it | M | High | internal |
| Password recovery by email | Needs an outgoing email service | M | Medium | lichess, internal, lishogi |
| Profile details (bio, country flag, links) | Personality on profiles; flags show up on leaderboards | S | Low | lichess, lidraughts, libaduk, lishogi |
| Captcha instead of the per-username login lockout | Today 20 wrong passwords lock an account for 15 minutes, which an attacker can abuse | M | Low | internal |
| Privacy settings: who can challenge, message or follow me | Reduces harassment once social features exist | S | Low | lichess |
| Kid mode (no chat or messages) | Safer for young players | S | Low | lichess |

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
| Tournaments: Arena and Swiss, then calendar, shields, ladders, round robin and team battles | Main engagement driver on lichess-style sites | L | Medium | lichess, lidraughts, lishogi |
| Bot accounts through a bot API (engines play on the site, list of online bots) | Lets engine authors join, gives players more opponents | L | Low | lichess, lishogi |
| Simultaneous exhibitions | Strong players against many at once | L | Low | lichess, lidraughts, lishogi |

## Learn

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Interactive lessons with saved progress (rules, pieces, fundamentals, etiquette, each with exercises on the board) | Gungi is new to almost everyone; learning by playing converts far better than a rules page. The piece trainer is a starting point | L | High | lichess, libaduk, lishogi |
| Mate problems (tsume style): find the forced mate in N moves | Mates can be found and verified by search, so problems can be generated without a strong evaluation; a natural first puzzle type | M | High | lishogi |
| Puzzles: daily and random, with ratings, themes and a personal dashboard | Daily reason to come back. Needs a stronger engine or a curated set | L | Medium | lichess, lidraughts, libaduk, lishogi |
| Timed puzzle modes (Streak, Storm, Racer against other players) | Short, competitive sessions that bring players back | M | Low | lichess |
| Practice positions against the computer | Learn key situations by playing them out | M | Low | lichess |
| Coordinate trainer, in the notation the player chose | Board fluency | M | Low | lichess, lidraughts, lishogi |
| Game library (curated collections of notable games) | Study material once there are good games to show | M | Low | libaduk |
| Studies (shared annotated analysis with chapters) | Teaching and community content | L | Low | lichess, lidraughts, lishogi |
| Coaches directory | Connects learners with teachers | S | Low | lichess, lishogi |
| Videos library | Curated learning content | S | Low | lichess |

## Watch

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| TV channels per mode and for computer games | Something to watch in every mode | S | Low | lishogi |
| Clocks on the home featured game | Livelier home page | S | Low | libaduk |
| Streamers and broadcasts | Only when there are Gungi streams or events | M | Low | lichess, lidraughts, libaduk, lishogi |

## Display and settings

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Sound sets, including spoken moves | Personal taste and accessibility | M | Low | lichess, lishogi |
| Custom background image | Personal taste | S | Low | lichess, lishogi |
| Language shortcut in the header | Faster than opening the settings menu | S | Low | lishogi |
| 3D board and board adjustments (brightness, contrast, hue) | Personal taste and accessibility | M | Low | lichess |
| Blind mode for screen readers | Accessibility: lichess is fully playable without seeing the board | L | Medium | lichess |
| More languages through a community translation platform | lichess has over 100 languages translated by volunteers | M | Medium | lichess |

## Community

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Official social media: a Discord server first (community and support), then X, YouTube, Twitch and Instagram, each linked from the footer with its icon (icons from Simple Icons, CC0) | Gives players a place to meet, ask questions and follow news; Discord needs moderators before it opens | S | Medium | lichess, lishogi |
| Community links in the menu and footer (GitHub issues, community group, social media) | The issue tracker is only linked from the FAQ and contact page | S | Medium | lichess, libaduk, lishogi |
| Recent activity feed (finished games, new players) | Same | S | Low | libaduk |
| Leaderboard: drop inactive players, show rating trend | lichess convention | S | Low | lichess, lidraughts, lishogi |
| Profile tab counts follow the mode filter | Counts are global today while the list is filtered | S | Low | internal |
| Rating history chart and per-mode performance stats on the profile | Players love seeing progress | M | Medium | lichess |
| Head-to-head record between two players (crosstable) | Rivalries; shown on game pages and profiles | S | Low | lichess |
| Activity timeline on profiles and a feed of followed players | Social glue for the follow feature that already exists | M | Low | lichess |
| Private messages and a notification bell | Base for direct challenges, follows and moderation notices. Only after moderation tools exist | M | Medium | lichess |
| User blogs | Community content | M | Low | lichess |
| Chat in games, on TV and a site chat room | Social core of lichess. Only after moderation tools exist | M | Medium | lichess, lidraughts, libaduk, lishogi |
| Teams, forum and blog | Community spaces | L | Low | lichess, lidraughts, lishogi |
| Friendly sites page | Cross-links with other lichess-style sites | S | Low | lishogi |

## Tools

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Record a game played on a physical board (kifu), move by move with players and result | Gungi has an official physical board; owners could record home games and analyse them here | M | High | libaduk |
| Board editor (set up any position, fill hands, save and download) | Study and puzzle creation | M | Medium | lichess, lidraughts, libaduk, lishogi |
| Import a game from the export format | Pairs with the export that already exists | M | Medium | lichess, lidraughts, libaduk, lishogi |
| Computer analysis in the browser (evaluation, best line, mistakes in a finished game) | Core study tool on lichess-style sites. Needs a stronger engine | L | Medium | lichess, lishogi |
| Learn from your mistakes: replay the critical moments of your own games | The most loved study feature on lichess. Needs the computer analysis | M | Medium | lichess |
| Draft explorer: statistics of popular setups and first moves, from played games | The Gungi counterpart of the lichess opening explorer; the draft is where games are won or lost | M | Medium | lichess |
| Personal insights (where you win and lose, by mode, color, phase) | Self-improvement | L | Low | lichess |
| Bookmarks and private notes on games | Keep track of interesting games | S | Low | lichess |
| Advanced game search | Find games by player, mode, rating, result and date across the site | M | Low | lichess, lidraughts, lishogi |
| Record a physical board with the camera | Computer vision; a strong differentiator | XL | Low | libaduk |

## Platform

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Public API with personal tokens (and OAuth for third-party apps) | Lets the community build tools, bots and integrations | L | Medium | lichess |
| Donations or patrons | Funding, if wanted | S | Low | lichess, lidraughts, lishogi |
| Preact 11 | Dependabot update; CI fails on stricter ARIA types, and the prerender needs a compatible preact-render-to-string; a major runtime release, so it needs a full UI pass | M | Medium | internal |
