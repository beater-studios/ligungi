# ligungi

[![CI](https://github.com/beater-studios/ligungi/actions/workflows/ci.yml/badge.svg)](https://github.com/beater-studios/ligungi/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)
[![Uptime](https://incidents.betterstack.com/status-badges/v2/monitor/3448b.svg)](https://beaterstudios.betteruptime.com/)

A free platform to play Gungi (軍儀), the board game from HUNTER×HUNTER, online, with a lichess-inspired interface and the official 2022 rules.

- Real-time online games: lobby with automatic pairing, challenge links, clocks with increment, draw offers, rematch, abort, and claiming victory when the opponent leaves.
- Optional accounts, Glicko-2 rating per mode, leaderboards, following other players, and profiles with a filterable game history.
- Play against the computer (in the browser), analysis board, live games, and a rules page with diagrams and an interactive piece trainer.
- All 4 official modes: Introductory, Beginner, Intermediate and Advanced (with the draft).
- Interface in Portuguese, English and Spanish.

## Documentation

- [docs/rules.md](docs/rules.md): the rules specification, with sources and interpretations.
- [docs/architecture.md](docs/architecture.md): packages, the flow of an online game, and technical decisions.
- [docs/api.md](docs/api.md): HTTP and WebSocket API.
- [docs/backlog.md](docs/backlog.md): candidate work and ideas, not committed to.

## Structure

| Folder | What it is |
|---|---|
| [packages/engine](packages/engine) | Rules engine in TypeScript, no dependencies. Used by both the browser and the server. |
| [packages/board](packages/board) | Framework-free board component (the equivalent of chessground). |
| [packages/bot](packages/bot) | Computer opponent, 3 levels. |
| [packages/protocol](packages/protocol) | Types and validation shared by the server and the site. |
| [apps/server](apps/server) | Node server: HTTP, WebSocket and SQLite (built into Node). |
| [apps/web](apps/web) | The site, in Preact. |

## Development

Requires Node 24.22.1 or newer and npm 11.19 or newer (the exact version is in [.nvmrc](.nvmrc); with nvm, run `nvm use`).

```sh
npm install
npm run dev        # server on :4000 and site on http://localhost:5173
npm test
npm run typecheck
```

## Production

```sh
npm run build      # builds apps/web/dist
npm start          # server on :4000 serving the site and the API
```

Server environment variables:

| Variable | Default | Use |
|---|---|---|
| `PORT` | `4000` | HTTP port. |
| `HOST` | `0.0.0.0` | Interface. |
| `DATABASE_PATH` | `data/ligungi.db` | SQLite file. |
| `STATIC_DIR` | (none) | Folder of the built site. |
| `SECURE_COOKIES` | `false` | Use `true` behind HTTPS. |
| `TRUST_PROXY` | `none` | Where the client IP comes from, for rate limiting: `none` (the TCP connection), `cloudflare` (`CF-Connecting-IP`) or `proxy` (last `X-Forwarded-For` entry, from one trusted reverse proxy). |
| `CLOUDFLARE_WEB_ANALYTICS` | `false` | `true` lets Cloudflare Web Analytics' beacon through the CSP. |
| `ABORT_AFTER_MS` | `60000` | Time for the first move before the game is aborted. |
| `CLAIM_AFTER_MS` | `30000` | Time the opponent must be away before victory can be claimed. |

Visit statistics are optional: build the site with `VITE_CF_ANALYTICS_TOKEN` (the public token of a Cloudflare Web Analytics site set up for manual install) and run the server with `CLOUDFLARE_WEB_ANALYTICS=true`. The site then asks for consent and only loads the beacon after the visitor accepts; without the token there is no notice and no analytics.

The site footer links to the source code at https://github.com/beater-studios/ligungi (an AGPL requirement for anyone running the site publicly). If you publish a fork, point to your own code by setting `VITE_SOURCE_URL` at build time.

Behind HTTPS (a reverse proxy or a CDN in front of the server), use `SECURE_COOKIES=true`. The proxy must forward WebSocket on `/ws` and the `Host` or `X-Forwarded-Host` header.

Set `TRUST_PROXY` to match how traffic reaches the server, otherwise rate limits see every user as the same IP (behind a proxy) or can be bypassed with forged headers. Use `cloudflare` only when the origin accepts traffic from Cloudflare alone (Cloudflare Tunnel or a firewall limited to Cloudflare's IP ranges); if the origin is reachable directly, anyone can forge `CF-Connecting-IP`.

There is a [Dockerfile](Dockerfile) that builds an image with the server and the site, with the database in `/data`. The build context has no `.git`, so pass the commit for the footer and `/api/version`: `docker build --build-arg LIGUNGI_COMMIT=$(git rev-parse --short HEAD) .`

## Versions

The site and the server share one version, following semver; see [CHANGELOG.md](CHANGELOG.md). The footer of the site shows the running version and commit.

## Contributing

Contributions are welcome: bug reports, rule corrections backed by a source, translations and code. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. To report a security issue, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

ligungi is made by [Beater Studios](https://beaterstudios.com/).

Copyright (C) 2026 Beater Studios. Open source under the [GNU AGPL-3.0](LICENSE) (or any later version), like lichess and its derivatives. The files in `apps/web/vendor/lila` remain copyright of the lila authors, under the same license (see their [NOTICE](apps/web/vendor/lila/NOTICE.md)).

Gungi and HUNTER×HUNTER belong to their owners (Yoshihiro Togashi, Shueisha, Universal Music). ligungi is not affiliated with them and uses no characters, artwork or logos from the series.
