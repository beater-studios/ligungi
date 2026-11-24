# Listings

Where ligungi is listed outside its own site, what was filled in, and where it could be published next. The images for listings are rendered to the git-ignored `/media` folder from the sources in `apps/web/brand` (see its README).

## Listed

| Where | Status | What was filled in |
|---|---|---|
| [GitHub](https://github.com/beater-studios/ligungi) | topics set 2026-11-23 | Description; topics abstract-strategy-game, board-game, game-engine, glicko2, gungi, hunter-x-hunter, lichess, multiplayer, nodejs, online-game, open-source, preact, sqlite, typescript, websocket, accessibility, puzzles, anime, browser-game, strategy-game (20, the limit). |
| [Discord](discord.md) | community server live; application `ligungi` (bot) | Description, tags (gungi, board game, strategy, open source, community), banner `discord/ligungi-banner-680x240.png`, Terms and Privacy links. Server traits: Board games, Strategy, Puzzles & lessons, Beginner friendly, Multilingual |
| [IGDB](https://www.igdb.com/) | submitted 2026-11-20, in review | Main game, released 2026-11-12 worldwide (full release) on Web browser; genres Strategy, Card & Board Game, Puzzle; theme Warfare; franchise Hunter x Hunter if available; online multiplayer, 2 players; company Beater Studios (main developer and publisher); interface in English, Portuguese (Brazil) and Spanish; keywords gungi, abstract strategy, open source, stacking, free to play ("board game" and "fan game" are not allowed there); no engine, version or age ratings. Images: covers, alternative and square covers, icon, key art with and without logo, infographic, three logos and eight screenshots, all from `/media/igdb` |
| [AlternativeTo](https://alternativeto.net/software/ligungi/about/) | submitted 2026-11-20; the ligungi page is live since 2026-11-21 | ligungi (free, open source, web; full description, English, Portuguese and Spanish) and a new neutral page for Gungi.io (freemium subscription, price left empty since it is only shown after signing in; release date from the first archived snapshot), each listed as the other's alternative. The review notes say that the ligungi developer added both. 軍儀Web was not added |
| [Product Hunt](https://www.producthunt.com/posts/ligungi) | launch scheduled for 2026-11-28 (00:00 Pacific), launch 1325860 | Name ligungi, tagline "Play Gungi, the HUNTER×HUNTER board game, free online", a description of its own (439 of the 500 characters), free, open source, solo maker, team of 1 to 10; launch tags Board Games, Strategy Games, Open Source and GitHub (added from the links); category Games; links to GitHub, AlternativeTo and `ligungi.org/discord`; thumbnail and six gallery images from `/media/producthunt`; a maker comment asking newcomers whether it is easy to get started |
| [websitelaunches.com](https://websitelaunches.com/site/ligungi.org) | claimed (a directory that lists new domains on its own) | Title, description (official 2022 rules, fan project), category games, location Brazil, favicon `icon-512.png`, screenshot `listings/ligungi-home-1280x800.png`. No badge and no paid plan |
| "Awesome" lists on GitHub | submitted 2026-11-23, waiting for review | [awesome-open-source-games #99](https://github.com/michelpereira/awesome-open-source-games/pull/99) (Browser-Based > Boardgame, next to Lichess and PlayHex), [open-source-games #161](https://github.com/bobeff/open-source-games/pull/161) (Turn-Based strategies), [awesome-preact #121](https://github.com/preactjs/awesome-preact/pull/121) (Example Apps) and [OSGL issue #515](https://github.com/Trilarion/opensourcegames/issues/515) (a new entry in their template). Not yet: awesome-selfhosted asks for 4 months since the first release (from March 2027) |

Posted:

| Date | Where | Link |
|---|---|---|
| 2026-11 | r/HunterXHunter | https://www.reddit.com/r/HunterXHunter/comments/1xuyjqn/gungi_now_has_its_own_lichess_ligungiorg_free_and/ |
| 2026-11-20 | r/abstractgames | https://www.reddit.com/r/abstractgames/comments/1y1j16l/gungi_the_stacking_strategy_game_from/ |
| 2026-11-21 | r/WebGames | https://www.reddit.com/r/WebGames/comments/1y2e33f/ligungi_play_gungi_the_towerstacking_strategy/ |
| 2026-11-23 | r/playmygame | https://www.reddit.com/r/playmygame/comments/1y3fe60/ligungi_an_online_version_of_gungi_the/ |

The shared texts, in English:

- **Short:** Free, open source site to play Gungi (軍儀), the strategy board game from HUNTER×HUNTER, with the official 2022 rules: rated and casual games, play against the computer, puzzles, lessons, studies and an analysis board. A fan project, not officially affiliated with the rights holders.
- **Long:** ligungi is a free, open source website to play Gungi (軍儀), the two-player strategy board game from the HUNTER×HUNTER manga, with the official rules published in 2022. Pieces can be stacked into towers of up to three, and a tower's height extends the reach of the piece on top. Players build their armies in an open draft, taking turns, or start from fixed setups. It offers rated and casual games with Glicko-2 ratings, correspondence games, play against the computer, daily puzzles, Puzzle Streak and Puzzle Storm, interactive lessons, studies, an analysis board and a screen reader mode. A fan project, not officially affiliated with the rights holders.

Share the Discord server as `discord.ligungi.org` (or `ligungi.org/discord`), never the raw invite, so a new invite never breaks an old post. The site links to `discord.ligungi.org` too.

## Where to publish next

Ideas to do when convenient, roughly by reach for the effort.

| Where | Why | Effort | Notes |
|---|---|---|---|
| Google Play, as the site wrapped in an app (Trusted Web Activity) | Reach on phones, and the store gives the age ratings (IARC) that IGDB and others ask for | medium | USD 25 one-time developer fee, plus the app wrapper and its listing |
| PreMiD store (Discord activity) | "Playing ligungi" on the Discord profile of PreMiD users, with a button to the game | low | The activity is written (outside this repo, see the PreMiD row of [roadmap.md](../roadmap.md)). PreMiD only takes domains at least 2 months old: open the pull request from 2027-01-12, after checking that every screen of the site is covered. |
| Microsoft Store, as the site packaged with PWABuilder | A real store listing on Windows, and the individual developer account is free (unlike Google Play) | medium | PWABuilder found the manifest ready to package (2026-11-23); the screenshots and a service worker that shows a "no connection" page shipped in 0.9.3. Submitted for certification on 2026-11-24 from a Partner Center account with Beater Studios as publisher: package 1.0.1.0 (desktop only, with an App URI Handler for ligungi.org), IARC rating 3+ (PEGI 3, ESRB Everyone, Livre in Brazil) and the listing in English, Portuguese and Spanish, held until published by hand. Next: publish once certified (after the `.well-known/windows-app-web-link` file is live), then add the IARC id that comes by email to the manifest |
| Short videos (YouTube Shorts, TikTok) | "How to play Gungi in 60 seconds" or a sped-up game; the HUNTER×HUNTER audience is large and short video reaches it for free | medium | Screen recordings of the site, with the link in the description |
| Partnerships with HUNTER×HUNTER Discord servers | Cross-promotion agreed with their moderators works where unasked posts get removed | low | Ask the moderators first; offer a mention on our server in return |

Not recommended:

- Browser game portals (CrazyGames, Poki, Newgrounds): they require their SDK and ads, against the site's "no ads".
- Links on HUNTER×HUNTER wikis and Wikipedia: counted as self-promotion there and usually removed.
- The lichess forum and community blogs: self-promotion there looks bad, and ligungi relies on its good relationship with lila.
- Discord server lists (Disboard, top.gg, discord.me): listing the server means adding their bot to it, which we do not do.