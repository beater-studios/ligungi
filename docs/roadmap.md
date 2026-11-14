# Roadmap

Work the maintainer has confirmed. Candidates and ideas live in [backlog.md](backlog.md); an item moves here only once it is confirmed, and leaves this file (for the changelog) once it ships.

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more).

| Item | Why | Size | Notes |
|---|---|---|---|
| Byo-yomi time control (for example 10 min + 30 s), with an optional spoken countdown | The traditional clock of Japanese games: once the main time runs out, every move has a fixed period | M | New time control type in game creation, the server clock and the clock display; optionally several periods (3 x 30 s). The draft keeps its own clock rule. |
| Rating history chart and per-mode stats on the profile | Players love seeing progress | M | The history comes from the rated games already stored (rating before plus the change), so no new data is needed. A chart per mode on the profile, drawn as inline SVG (no chart library), with the peak, the current rating and stats such as results by color and by game length. |
| Board editor | Set up any position for study or to share; also the way to make puzzles later | M | Place and stack pieces of both sides on any square, fill the hands, choose the mode and who moves, with checks that the position follows the rules (piece counts, tower heights, the Marshal never covered). Opens the position in the analysis and gives its FEN and a link. |
| Import a game | Pairs with the export that already exists, so games played elsewhere can be studied here | M | Paste or upload a game in the export format (rulebook or machine notation); every move is checked by the engine, and a wrong one is reported with its number. The imported game opens in the analysis, not as a played game, so it never touches ratings. |
| Draft explorer | The Gungi counterpart of the lichess opening explorer; the draft is where games are won or lost | M | Statistics from finished games of the draft modes (intermediate and advanced): which pieces players place first and where, how often, and with what results, stage by stage. Filters by mode and rating range. Computed on the server from the stored games and cached, refreshed now and then. |
