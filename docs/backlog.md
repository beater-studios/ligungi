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
| Kyu and dan ranks derived from the rating, shown beside names | Japanese-game flavor; easier to read than a number | S | Medium | lishogi |
| Speed categories on quick pairing (Bullet, Blitz, Rapid, Classical) | lichess convention, easier to read than raw times | S | Low | lichess, lidraughts, libaduk |
| Computer presets on quick pairing (play the bot at each level in one click) | Shortcut for the most common solo game | S | Low | lichess, lishogi |
| Rating range filter for seeks | Find opponents of similar strength | S | Low | lichess, lishogi |
| Keyboard move input | Speed and accessibility | M | Low | lichess |
| Zen mode (hide everything but the board and clocks) | Focus while playing | S | Low | lichess |
| Bot accounts through a bot API (engines play on the site, list of online bots) | Lets engine authors join, gives players more opponents | L | Low | lichess, lishogi |
| Simultaneous exhibitions | Strong players against many at once | L | Low | lichess, lidraughts, lishogi |

## Watch

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| TV channel for games against the computer | Something to watch even when few people play. Games against the computer run in the browser, so the server never sees them; it needs bots that play on the server, as with bot accounts | S | Low | lishogi |

## Display and settings

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Sound sets, including spoken moves | Personal taste and accessibility | M | Low | lichess, lishogi |
| Custom background image | Personal taste | S | Low | lichess, lishogi |
| Language shortcut in the header | Faster than opening the settings menu | S | Low | lishogi |
| More languages through a community translation platform | lichess has over 100 languages translated by volunteers | M | Medium | lichess |

## Community

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Official social media: a Discord server first (community and support), then X, YouTube, Twitch and Instagram, each linked from the footer with its icon (icons from Simple Icons, CC0) | Gives players a place to meet, ask questions and follow news; Discord needs moderators before it opens | S | Medium | lichess, lishogi |
| Community links in the menu and footer (GitHub issues, community group, social media) | The issue tracker is only linked from the FAQ and contact page | S | Medium | lichess, libaduk, lishogi |
| Private messages, with a setting for who can message me | Players can only reach each other through a challenge today; moderation tools and reports now exist, and the account page already has who can challenge and who can follow | M | Medium | lichess |
| User blogs | Community content | M | Low | lichess |
| Chat in games, on TV and a site chat room | Social core of lichess. Moderation tools and reports now exist | M | Medium | lichess, lidraughts, libaduk, lishogi |
| Teams, forum and blog | Community spaces | L | Low | lichess, lidraughts, lishogi |
| Friendly sites page | Cross-links with other lichess-style sites | S | Low | lishogi |

## Tools

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Computer analysis in the browser (evaluation, best line, mistakes in a finished game) | Core study tool on lichess-style sites. Needs a stronger engine | L | Medium | lichess, lishogi |
| Learn from your mistakes: replay the critical moments of your own games | The most loved study feature on lichess. Needs the computer analysis | M | Medium | lichess |
| Record a physical board with the camera | Computer vision; a strong differentiator | XL | Low | libaduk |

## Platform

| Item | Why | Size | Priority | Seen on |
|---|---|---|---|---|
| Public API with personal tokens (and OAuth for third-party apps) | Lets the community build tools, bots and integrations | L | Medium | lichess |
| Donations or patrons | Funding, if wanted | S | Low | lichess, lidraughts, lishogi |
| Web push notifications with the site closed (correspondence turns, challenges) | Correspondence games last days, and today the turn notice (in the bell or as a browser notification) needs the site open in some tab. Needs a service worker, VAPID keys, a table of subscriptions and the server sending the messages (with `node:crypto`, or the `web-push` package, which would be a new dependency) | M | Medium | lichess |
