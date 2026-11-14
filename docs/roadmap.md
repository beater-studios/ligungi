# Roadmap

Work the maintainer has confirmed. Candidates and ideas live in [backlog.md](backlog.md); an item moves here only once it is confirmed, and leaves this file (for the changelog) once it ships.

Size: **S** (hours to a day), **M** (a few days), **L** (a week or more).

| Item | Why | Size | Notes |
|---|---|---|---|
| Byo-yomi time control (for example 10 min + 30 s), with an optional spoken countdown | The traditional clock of Japanese games: once the main time runs out, every move has a fixed period | M | New time control type in game creation, the server clock and the clock display; optionally several periods (3 x 30 s). The draft keeps its own clock rule. |
| Draft explorer | The Gungi counterpart of the lichess opening explorer; the draft is where games are won or lost | M | Statistics from finished games of the draft modes (intermediate and advanced): which pieces players place first and where, how often, and with what results, stage by stage. Filters by mode and rating range. Computed on the server from the stored games and cached, refreshed now and then. |
