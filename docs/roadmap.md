# Roadmap

Work the maintainer has confirmed. Candidates and ideas live in [backlog.md](backlog.md); an item moves here only once it is confirmed, and leaves this file (for the changelog) once it ships.

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more).

| Item | Why | Size | Notes |
|---|---|---|---|
| Game library (curated collections of notable games) | Study material once there are good games to show | M | Collections of games from the site or imported, opened in the analysis board. |
| Coaches directory | Connects learners with teachers | S | Profiles that opt in, with languages and contact links. |
| Videos library | Curated learning content | S | A curated list of links (YouTube and similar), filtered by language and level. |
| Streamers and broadcasts | Shows Gungi streams and events on the site | M | Only once there are Gungi streams or events to show. |
| Tournaments: Arena and Swiss, then calendar, shields, ladders, round robin and team battles | Main engagement driver on lichess-style sites | L | Arena and Swiss first; the rest only once those are in use. |
| More languages through a community translation platform | lichess has over 100 languages translated by volunteers; Gungi players are spread around the world | M | The interface texts are ICU MessageFormat in JSON with English as the source, a language is offered at 80% translated and anything missing shows in English. The long pages are Markdown per language, also with English for what is missing. Still to do: the Weblate project (Hosted Weblate, libre plan). The libre plan asks for at least three months of active development (the repository started on 2026-11-12), so the request waits until mid-February 2027; when it is set up, the README mentions Weblate with its badge, as the plan requires. Until then, translations come as pull requests to the locale files and pages. |
| Discord presence through PreMiD | "Playing ligungi" on the Discord profile of players who use the PreMiD browser extension; a website cannot set the Discord status on its own | S | A presence script sent to the PreMiD presences repository (outside this repo). The site side is done: pages describe the activity in `data-activity-*` attributes (see "Browser integrations" in [architecture.md](architecture.md)). The script is written and waits for testing; PreMiD only accepts domains at least 2 months old, so the pull request goes in from mid-January 2027, with the logo and thumbnail moved to Imgur as its guidelines ask. |
| Kid mode (no chat or messages) | Safer for young players | S | Hides chat, messages and external links. Matters most once chat or messages exist. |
| Blind mode for screen readers | Accessibility: lichess is fully playable without seeing the board, and Gungi, whose best-known player in the story is blind, should be too | L | The screen reader mode is built on every screen of the map in [accessibility.md](accessibility.md). An automated check (axe, `apps/web/test/a11y.test.tsx`) runs on every screen in the tests. Still to do: a test with a player who uses a screen reader every day (VoiceOver or NVDA), then the fixes it brings. |
