# Roadmap

Work the maintainer has confirmed. Candidates and ideas live in [backlog.md](backlog.md); an item moves here only once it is confirmed, and leaves this file (for the changelog) once it ships.

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more).

| Item | Why | Size | Notes |
|---|---|---|---|
| Puzzle Racer (puzzle races against other players) | Short, competitive sessions that bring players back | M | Streak and Storm shipped; Racer races several players live on the same puzzles, so it waits for more players online. |
| Game library (curated collections of notable games) | Study material once there are good games to show | M | Collections of games from the site or imported, opened in the analysis board. |
| Coaches directory | Connects learners with teachers | S | Profiles that opt in, with languages and contact links. |
| Videos library | Curated learning content | S | A curated list of links (YouTube and similar), filtered by language and level. |
| Streamers and broadcasts | Shows Gungi streams and events on the site | M | Only once there are Gungi streams or events to show. |
| Tournaments: Arena and Swiss, then calendar, shields, ladders, round robin and team battles | Main engagement driver on lichess-style sites | L | Arena and Swiss first; the rest only once those are in use. |
| More languages through a community translation platform | lichess has over 100 languages translated by volunteers; Gungi players are spread around the world | M | The site and the long pages (about, FAQ, terms) are in pt, en and es today, typed so a missing key fails the build. Needs the platform (Weblate or Crowdin, both free for open source), a way to sync its files with the dictionaries, and a rule for when a language is complete enough to offer. |
| Sound sets | Personal taste: other move and game sounds to pick from | M | Spoken moves shipped first. The sets need sounds under a license that fits AGPL, chosen in Settings with a preview. |
| Friendly sites page | Cross-links with the other lila-based sites (lichess, lishogi, lidraughts, libaduk), as lishogi does | S | A page with a line about each site; worth asking them to link back. |
| Kid mode (no chat or messages) | Safer for young players | S | Hides chat, messages and external links. Matters most once chat or messages exist. |
| Blind mode for screen readers | Accessibility: lichess is fully playable without seeing the board, and Gungi, whose best-known player in the story is blind, should be too | L | The screen reader mode is built on every screen of the map in [accessibility.md](accessibility.md). Still to do: a test with a player who uses a screen reader every day (VoiceOver or NVDA) and an automated check (axe), then the fixes they bring. |
