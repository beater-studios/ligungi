# Contributing to ligungi

Thanks for wanting to help. Bug reports, rule corrections, translations and code are all welcome.

## Before you start

- **Bugs and ideas:** open an issue using one of the templates. For anything larger than a small fix, open an issue first so we can agree on the approach before you write code.
- **Security issues:** never open a public issue. Follow [SECURITY.md](SECURITY.md).
- **Rules:** the game follows the official 2022 rules. Read [docs/rules.md](docs/rules.md) before proposing a rule change (see [Rules](#rules) below).

## Setup

Requires Node 24.22.1 or newer and npm 11.19 or newer (the exact version is in [.nvmrc](.nvmrc); with nvm, run `nvm use`).

```sh
npm install
npm run dev        # server on :4000 and site on http://localhost:5173
```

Before opening a pull request, make sure these pass. CI runs the same checks:

```sh
npm run typecheck
npm test
npm run build
```

[docs/architecture.md](docs/architecture.md) explains how the packages fit together and [docs/api.md](docs/api.md) documents the API.

## Rules

[docs/rules.md](docs/rules.md) is the source of truth for the engine: if the code and the document disagree, one of them is wrong.

- Sources, in order of authority: the official rulebook, then the official Universal Music FAQ, then everything else (other engines, sites, fan rulesets). Pre-2022 fan rules are not used.
- A rule change must cite its source (rulebook page or FAQ question) in the issue or pull request.
- When a rule is ambiguous and we pick an interpretation, record it in section 11 of [docs/rules.md](docs/rules.md).
- Every rule change needs engine tests in `packages/engine/test`, ideally reproducing the rulebook or FAQ example.

## Code conventions

- **TypeScript, strict.** All code is in English: file names, identifiers, database schema, routes, environment variables and log messages.
- **Comments only when needed**, to explain a why that the code does not make clear, and always in English.
- **Server syntax:** the server runs TypeScript directly on Node (type stripping), so it uses only erasable syntax: no `enum`, `namespace` or constructor parameter properties.
- **Dependencies:** [.npmrc](.npmrc) pins exact versions, only installs releases at least 7 days old, never runs dependency install scripts and only accepts registry packages. Do not bypass these settings. A new dependency must work without install scripts and needs a reason in the pull request.
- **Server dependencies:** the server has a single runtime dependency (`ws`). Discuss in an issue before adding another one, since each dependency is more surface to keep secure.
- **Text shown to users** goes through the dictionaries in `apps/web/src/i18n/`: `pt.tsx` is the source, and `en.tsx` and `es.tsx` share its type, so TypeScript reports any missing key. Add the text in all three languages. If you cannot translate one, open the pull request anyway and say so.
- **Server errors** are stable codes in `packages/protocol/src/errors.ts`, translated by the site. Never send free-form error text that the client has to display.
- **Look and feel:** the site reuses lichess's styles. The SCSS in `apps/web/vendor/lila` is copied unmodified from lila (see its `NOTICE.md`). Our own styles live in `apps/web/src/styles/ligungi.scss`.
- **Assets:** never add HUNTER×HUNTER characters, artwork or logos, nor the lichess name, logo or favicon. Any new asset (image, font, sound) must have a license compatible with the AGPL.

## Commits and pull requests

Commit messages follow the [Karma convention](https://karma-runner.github.io/latest/dev/git-commit-msg.html), with a short description and no body:

```
feat: add friends list
fix(engine): block archer jumps over taller towers
docs: explain the free draft option
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

In the pull request:

- describe what changed and why, and link the issue;
- add tests for changes to the engine, the protocol or the server;
- add screenshots for visual changes, in both the light and dark themes when relevant.

## License

ligungi is licensed under the [GNU AGPL-3.0](LICENSE) or any later version. By contributing, you agree that your contribution is licensed under the same terms.
