# Changelog

Notable changes to ligungi. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). The site and the server share one version, set in the root `package.json`; the footer shows it together with the commit of the build.

## [Unreleased]

## [0.1.0] - 2026-11-12

First public version.

### Added

- Rules engine for the official 2022 Gungi rules (all four modes, draft, towers, drops, betrayal), with the specification in `docs/rules.md`.
- Online play in real time: lobby with automatic pairing, challenge links, clocks with increment, draw offers, rematch, abort and victory claims.
- Optional accounts with Glicko-2 ratings per mode, leaderboards, following players and profiles with a filterable game history.
- Play against the computer, analysis board, live games and a rules page with an interactive piece trainer.
- Interface in Portuguese, English and Spanish.
- Lichess-based look (lila's styles), shared form components and a design system page at `/design`.

[Unreleased]: https://github.com/beater-studios/ligungi/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/beater-studios/ligungi/releases/tag/v0.1.0
