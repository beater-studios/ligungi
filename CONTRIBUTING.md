# Contributing to ligungi

Thanks for wanting to help. Bug reports, rule corrections, translations and code are all welcome.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and ideas:** open an issue using one of the templates. For anything larger than a small fix, open an issue first so we can agree on the approach before you write code.
- **Security issues:** never open a public issue. Follow [SECURITY.md](SECURITY.md).
- **Rules:** the game follows the official 2022 rules. Read [docs/rules.md](docs/rules.md) before proposing a rule change (see [Rules](#rules) below).

## Setup

Requires Node 24.22.3 or newer and npm 11.19 or newer (the exact version is in [.nvmrc](.nvmrc); with nvm, run `nvm use`).

```sh
npm install
npm run dev        # server on :4000 and site on http://localhost:5173
```

Before opening a pull request, make sure these pass. CI runs the same checks, plus CodeQL and a scan of the dependencies with [vet](https://github.com/safedep/vet), and CodeRabbit may leave review comments:

```sh
npm run typecheck
npm test
npm run build
```

[docs/architecture.md](docs/architecture.md) explains how the packages fit together and [docs/api.md](docs/api.md) documents the API. [docs/accessibility.md](docs/accessibility.md) maps what each screen will need for screen readers: update it when you add a screen or change how one is played or read.

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
- **Text shown to users** goes through the locale files in `apps/web/src/i18n/locales/`, one JSON file per language in [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/). `en.json` is the source: a new text is a new key there, and a text that takes arguments (`{name}`, a plural, a select or a `<tag>` around a link) is also declared in `apps/web/src/i18n/schema.tsx`, with its arguments in the order the code passes them. Add the Portuguese and Spanish texts too when you can; otherwise leave them to the translators, and the site shows English until then.
- **Server errors** are stable codes in `packages/protocol/src/errors.ts`, translated by the site. Never send free-form error text that the client has to display.
- **UI components:** forms use the shared components in `apps/web/src/components/ui.tsx`. Run the site and open `/design` to see every component, color and pattern before building a screen.
- **Look and feel:** the site reuses lichess's styles. The SCSS in `apps/web/vendor/lila` is copied unmodified from lila (see its `NOTICE.md`). Our own styles live in `apps/web/src/styles/ligungi.scss`.
- **Assets:** never add HUNTER×HUNTER characters, artwork or logos, nor the lichess name, logo or favicon. Any new asset (image, font, sound) must have a license compatible with the AGPL.

## Translations

The site is translated by volunteers. The plan is [Weblate](https://weblate.org/), which checks the messages and sends its changes to the repository on its own; its free plan for open source asks for three months of active development, so it opens around February 2027 (see [docs/roadmap.md](docs/roadmap.md)). Until then, translate with a pull request: copy `apps/web/src/i18n/locales/en.json` to a file named by the language code (`fr.json`, `pt-PT.json`), translate the messages and leave the ones you did not translate as empty strings, so they show in English and do not count as translated.

- Each message is written in ICU MessageFormat. Keep the arguments in braces (`{name}`) as they are, and the tags around a part of the text (`<login>Sign in</login>`) around the matching words. A plural lists the forms your language needs: `{n, plural, one {# day} other {# days}}`, where `#` is the number. A select picks a text by a value, such as the side to move: `{color, select, white {White} other {Black}}`, so each language can agree the words with it.
- A message that is missing, or that Weblate's checks would reject, shows in English on the site, so a half-translated language still works.
- A language appears in the language menu once 80% of its messages are translated.
- The messages under `pieces` are the piece names: `names` in full, `short` for the move list (an abbreviation only for names longer than 9 letters, otherwise the same name) and `letters`, two letters for the letters piece style. No two pieces may share their name or their letters, or the site keeps the English set.
- The lists under `blind.words` are other words a player may type in the screen reader mode, one per line, written without accents. The English words always work too.
- The long pages (about, FAQ, contact, friendly sites, terms, privacy and the rule sources) are Markdown files in `apps/web/src/i18n/content/<language>/`, one per page, translated from the English ones in `en/`. Keep the links as they are: the part in parentheses names a page of the site (`/learn`) or an address the site knows (`lila`), and other links are not shown. Keep `{email}` and `{sources}` too. In the FAQ, each `## ` heading is a question. A page you have not translated shows in English.

## Commits and pull requests

Commit messages follow the [Karma convention](https://karma-runner.github.io/latest/dev/git-commit-msg.html), with a short description and no body:

```
feat: add friends list
fix(engine): block archer jumps over taller towers
docs: explain the free draft option
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Pull requests are squash merged, and the commit takes the pull request title, so write the title in the same format.

In the pull request:

- describe what changed and why, and link the issue;
- add tests for changes to the engine, the protocol or the server;
- add screenshots for visual changes, in both the light and dark themes when relevant.

## Versions and releases

The site and the server share one version, in the root `package.json`, following [Semantic Versioning](https://semver.org/): bump the patch for fixes, the minor for new features and the major for breaking changes (for example to the API or to stored data). Each build records its version and git commit; the site shows them in the footer and the server answers them at `GET /api/version`.

Every user-visible change gets a line under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md). A release moves those lines under the new version, bumps `package.json` and is tagged `vX.Y.Z`.

## License

ligungi is licensed under the [GNU AGPL-3.0](LICENSE) or any later version. By contributing, you agree that your contribution is licensed under the same terms.
