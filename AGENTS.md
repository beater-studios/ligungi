# AGENTS.md

Guidance for AI coding agents working on ligungi. `CLAUDE.md` is a symlink to this file. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md); everything there applies to agents too.

## Project

ligungi is a lichess-style site to play Gungi (the HUNTER×HUNTER board game) with the official 2022 rules. TypeScript monorepo with npm workspaces:

| Path | What it is |
|---|---|
| `packages/engine` | Rules engine, no dependencies. Shared by browser and server. |
| `packages/board` | Framework-free DOM board (like chessground). |
| `packages/bot` | Computer opponent, runs in a Web Worker. |
| `packages/protocol` | Types, validation and error codes shared by server and site. |
| `apps/server` | Node 24 server: `node:http`, `ws`, `node:sqlite`. |
| `apps/web` | Preact site with lila's (lichess) markup and styles. |

Read [docs/architecture.md](docs/architecture.md) before structural changes, [docs/rules.md](docs/rules.md) before touching game logic and [docs/api.md](docs/api.md) before changing routes or messages.

## Commands

```sh
npm install
npm run dev                      # server :4000 + Vite :5173
npm run typecheck                # all workspaces
npm test                         # all workspaces (vitest)
npm test -w @ligungi/engine      # one workspace
npm run build                    # builds apps/web/dist
```

Node and npm versions are enforced (`.nvmrc`, `engines`, `devEngines`, `engine-strict`). Never use `--force`, `--ignore-engines`, `--dangerously-allow-all-scripts` or similar flags to get past an install error.

A change is not done until `npm run typecheck`, `npm test` and `npm run build` pass. CI runs the same checks plus `npm audit --omit=dev --audit-level=high`.

## Game rules

- `docs/rules.md` is the source of truth. If code and spec disagree, one of them is wrong: fix it, do not paper over it.
- Source priority: official rulebook > official Universal Music FAQ > everything else. Never use pre-2022 fan rules, gungi.io or Komugi behavior as a source when they differ from the rulebook.
- Do not change a rule without a cited source. Record any interpretation in section 11 of `docs/rules.md`.
- Every rule change needs tests in `packages/engine/test`, ideally reproducing a rulebook or FAQ example.
- Settled decisions (do not revisit without the maintainer): moves that expose your own Marshal are not offered and having no safe move is a loss; betrayal is all or nothing and also works on an own-topped tower with enemy pieces below; color and first player are independent; the draft follows the rulebook (second player's "done" ends it), with "free draft" as a casual-only option.

## Conventions

- All code is in English: file names, identifiers, database schema, routes, environment variables, log messages. Only user-facing text is translated.
- Write comments only for a why that the code does not make clear, in English.
- Strict TypeScript with `exactOptionalPropertyTypes`. Avoid `any` and unchecked casts.
- Repository docs (README, `docs/`, templates) are in English. In Markdown, do not hard-wrap paragraphs and do not use em or en dashes.

### Dependencies

- `.npmrc` enforces exact versions (`save-exact`), a 7-day release age (`min-release-age`), no install scripts (`ignore-scripts`) and registry-only packages. Never override these settings.
- Ask before adding any dependency. Prefer Node built-ins and the existing stack. Each workspace declares the tools it uses (`typescript`, `vitest`), with exact versions.
- The Node version is pinned in `.nvmrc` and the Dockerfile image, and the `engines` floor is the latest patched release. When a Node security release comes out, bump all three together.

### Server

- Node runs the TypeScript source directly (type stripping), so use only erasable syntax: no `enum`, `namespace` or constructor parameter properties.
- Runtime dependencies stay minimal (only `ws`). Do not add one without asking.
- Errors are stable codes from `packages/protocol/src/errors.ts` (`HttpError(status, code)`, WebSocket `{ t: 'error', code, message }`). Add new codes there and their translations in the web dictionaries.
- SQL always uses bound parameters. Never interpolate user input into SQL.
- Schema changes are new entries appended to `MIGRATIONS` in `apps/server/src/db.ts`. Never edit an existing migration.
- Do not weaken the security checks in `app.ts`: JSON content type and same-origin for writes, origin check on WebSocket, auth rate limit, CSP.

### Web

- Styles: `apps/web/vendor/lila` is lila's SCSS copied unmodified (see its `NOTICE.md`). Never edit it. Our own styles go in `apps/web/src/styles/ligungi.scss`, using lila's theme variables so light and dark themes both work.
- Screens reuse lila's markup and class names so the vendored CSS applies. lila's custom tags (`i5d`, `bo3`, `app`, `z7yx`, `qzm`, `move`, `index`, `group`, `rating`, `name`, `line`) must be written in lowercase and declared in `src/lila-elements.d.ts`.
- Never hardcode user-facing text. Use `useT()` and the dictionaries in `src/i18n/`: `pt.tsx` is the source, and `en.tsx` and `es.tsx` share its type, so a missing key fails the typecheck. Always add all three languages.
- Long-form page content (about, FAQ, contact, terms, privacy, rule sources) lives in `src/i18n/content/`, one file per language typed by `Content`, read through `useContent()`. Shared external links and the repository URL (`SOURCE_URL`, set by `VITE_SOURCE_URL`) live in `src/i18n/content/shared.tsx` and `src/source.ts`; never hardcode them elsewhere.
- Piece names come from `usePieceNames()` and board labels from `t.board`, so they follow the chosen language.
- Forms are built only with the components in `src/components/ui.tsx` (Field, FieldRow, Select, Checkbox, RadioGroup, SubmitButton). The `/design` page (not linked in the menus) shows every component, color token and pattern; check it before building a screen and add new patterns there.
- For UI changes, check both themes and at least two languages.

## Assets and legal

- License: AGPL-3.0-or-later. Any new asset (image, font, sound, code) must be AGPL-compatible.
- Never add HUNTER×HUNTER characters, artwork or logos, nor the lichess name, logo or favicon.
- `references/` holds third-party material and is git-ignored except its README. Never commit its content.

## Planning

- `docs/backlog.md` lists candidate work (ideas, gaps, features seen on other lila-based sites). Only items the maintainer confirms move to `docs/roadmap.md`. Never move an item to the roadmap on your own.

## Versions

- One version for the whole project, in the root `package.json` (semver). Do not bump it unless asked; add user-visible changes under `[Unreleased]` in `CHANGELOG.md`.

## Git

- Commit messages follow the Karma convention, `type: description` or `type(scope): description`, with a short description and no body.
- Do not add AI attribution (`Co-Authored-By` trailers or session links) to commits or pull requests.
