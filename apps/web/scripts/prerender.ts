/**
 * Runs after `vite build` and the SSR build of src/prerender.tsx. Writes, inside dist/:
 * - pages/<lang>/<slug>.html: a public page fixed to one language (served for `?lang=`),
 * - pages/<lang>/<slug>.auto.html: the same page for the plain URL, whose language comes from the browser,
 * - pages/<lang>/shell.html: the head for every other route (profiles, games), with an empty body,
 * - offline/<lang>.html, offline/<lang>.app.html and sw.js: the "no connection" page (the installed app's version
 *   also links to the pages kept offline) and the service worker that shows it and, in the installed app, keeps the
 *   pages that work without a connection (OFFLINE_PAGES),
 * - sitemap.xml, robots.txt, llms.txt and llms-full.txt.
 * The server picks the file (apps/server/src/http.ts); the app takes over the markup when it starts.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** The minimum of a browser the app touches while its modules load and render. */
const installBrowserShims = (): void => {
  const location = { pathname: '/', search: '', hash: '', href: 'http://localhost/', origin: 'http://localhost' };
  const setUrl = (url: string) => {
    const parsed = new URL(url, location.href);
    Object.assign(location, { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash, href: parsed.href });
  };
  const noop = () => undefined;
  const element = () => ({ classList: { toggle: noop, add: noop, remove: noop }, style: { setProperty: noop }, lang: '' });
  const storage = new Map<string, string>();
  const globals: Record<string, unknown> = {
    window: globalThis,
    location,
    history: { pushState: (_: unknown, __: string, url: string) => setUrl(url), replaceState: (_: unknown, __: string, url: string) => setUrl(url) },
    navigator: { language: 'en', languages: ['en'], userAgent: 'ligungi-prerender' },
    sessionStorage: { getItem: () => null, setItem: noop },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    scrollTo: noop,
    document: {
      documentElement: element(),
      body: element(),
      head: { append: noop, appendChild: noop },
      hidden: false,
      title: '',
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: () => null,
      getElementById: () => null,
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
};

interface Rendered {
  readonly lang: string;
  readonly head: string;
  readonly body: string;
}
interface Page {
  readonly path: string;
  readonly slug: string;
}
type Lang = string;
interface Prerender {
  readonly LANGS: readonly Lang[];
  readonly localeOf: (lang: Lang) => string;
  readonly ready: () => Promise<unknown>;
  readonly PAGES: readonly Page[];
  readonly SITE_URL: string;
  readonly SOURCE_URL: string;
  readonly pageUrl: (path: string, lang?: Lang) => string;
  readonly renderPage: (page: Page, lang: Lang, fixedLang: boolean) => Rendered;
  readonly renderShell: (lang: Lang) => Rendered;
  readonly offlineTexts: (lang: Lang) => {
    lang: string;
    pageTitle: string;
    pageText: string;
    retry: string;
    offlineWorks: string;
    links: ReadonlyArray<{ href: string; label: string }>;
  };
  readonly OFFLINE_PAGES: readonly string[];
}

installBrowserShims();
const app = (await import(pathToFileURL(join(root, 'dist-ssr', 'prerender.js')).href)) as Prerender;
await app.ready();

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/;
if (!SEO_BLOCK.test(template) || !template.includes('<div id="app"></div>')) {
  throw new Error('index.html lost the <!--seo--> block or the empty #app element');
}

const fill = ({ lang, head, body }: Rendered): string =>
  template
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(SEO_BLOCK, () => head)
    .replace('<div id="app"></div>', () => `<div id="app">${body}</div>`);

const pagesDir = join(dist, 'pages');
rmSync(pagesDir, { recursive: true, force: true });
for (const lang of app.LANGS) {
  const dir = join(pagesDir, lang);
  mkdirSync(dir, { recursive: true });
  for (const page of app.PAGES) {
    writeFileSync(join(dir, `${page.slug}.html`), fill(app.renderPage(page, lang, true)));
    writeFileSync(join(dir, `${page.slug}.auto.html`), fill(app.renderPage(page, lang, false)));
  }
  writeFileSync(join(dir, 'shell.html'), fill(app.renderShell(lang)));
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

// Self-contained, since nothing else is cached: inline styles and logo, lila's colors, the theme from the system.
const logo = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8').trim();
/** `installed`: the installed app's version, which also links to the pages kept offline. */
const offlinePage = (lang: Lang, installed: boolean): string => {
  const t = app.offlineTexts(lang);
  const works = `
      <nav class="works" aria-label="${escapeHtml(t.offlineWorks)}">
        <p>${escapeHtml(t.offlineWorks)}</p>
        <ul>
${t.links.map((link) => `          <li><a href="${link.href}">${escapeHtml(link.label)}</a></li>`).join('\n')}
        </ul>
      </nav>`;
  return `<!doctype html>
<html lang="${t.lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(t.pageTitle)} · ligungi</title>
    <style>
      :root { color-scheme: dark; --bg: #161512; --box: #262421; --text: #bababa; --strong: #e2e2e2; --accent: #3692e7; }
      @media (prefers-color-scheme: light) { :root { color-scheme: light; --bg: #edebe9; --box: #fff; --text: #4d4d4d; --strong: #222; --accent: #1b78d0; } }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
      main { max-width: 26rem; margin: 1rem; padding: 2rem; background: var(--box); border-radius: 6px; text-align: center; }
      .logo svg { width: 4rem; height: 4rem; }
      h1 { margin: 0.5rem 0; color: var(--strong); font-size: 1.5rem; font-weight: 500; }
      a { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.4rem; border-radius: 4px; background: var(--accent); color: #fff; text-decoration: none; text-transform: uppercase; }
      .works { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--text) 25%, transparent); }
      .works ul { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
      .works a { display: block; margin: 0; padding: 0.5rem 1rem; background: transparent; color: var(--accent); box-shadow: inset 0 0 0 1px currentColor; text-transform: none; }
    </style>
  </head>
  <body>
    <main>
      <div class="logo" aria-hidden="true">${logo}</div>
      <h1>${escapeHtml(t.pageTitle)}</h1>
      <p>${escapeHtml(t.pageText)}</p>
      <a href="">${escapeHtml(t.retry)}</a>${installed ? works : ''}
    </main>
  </body>
</html>
`;
};
const offlineDir = join(dist, 'offline');
rmSync(offlineDir, { recursive: true, force: true });
mkdirSync(offlineDir, { recursive: true });
const offlineHash = createHash('sha256');
for (const lang of app.LANGS) {
  for (const [file, html] of [[`${lang}.html`, offlinePage(lang, false)], [`${lang}.app.html`, offlinePage(lang, true)]] as const) {
    offlineHash.update(html);
    writeFileSync(join(offlineDir, file), html);
  }
}
// Kept by the installed app so the offline pages run without a connection: the code, the styles and the fonts.
// Sounds and flags are kept as they load. The cache name follows these files and the kept pages, so it changes with a deploy.
const assets = readdirSync(join(dist, 'assets'))
  .filter((file) => /\.(js|css|woff2)$/.test(file))
  .sort()
  .map((file) => `/assets/${file}`);
offlineHash.update(assets.join('\n'));
for (const lang of app.LANGS) {
  for (const slug of [...app.OFFLINE_PAGES, 'shell']) offlineHash.update(readFileSync(join(pagesDir, lang, `${slug}.html`)));
}
const BUILD_LINE = /^const BUILD = .*;$/m;
const worker = readFileSync(join(root, 'scripts', 'sw.js'), 'utf8');
if (!BUILD_LINE.test(worker)) throw new Error('scripts/sw.js lost its BUILD line');
const build = { cache: `ligungi-offline-${offlineHash.digest('hex').slice(0, 12)}`, langs: app.LANGS, assets, pages: app.OFFLINE_PAGES };
writeFileSync(join(dist, 'sw.js'), worker.replace(BUILD_LINE, () => `const BUILD = ${JSON.stringify(build)};`));

const alternates = (path: string): string =>
  [
    ...app.LANGS.map((lang) => `<xhtml:link rel="alternate" hreflang="${app.localeOf(lang)}" href="${app.pageUrl(path, lang)}"/>`),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${app.pageUrl(path)}"/>`,
  ].join('');
const urls = app.PAGES.flatMap((page) =>
  [undefined, ...app.LANGS].map((lang) => `  <url><loc>${app.pageUrl(page.path, lang)}</loc>${alternates(page.path)}</url>`),
);
writeFileSync(
  join(dist, 'sitemap.xml'),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n'),
);

writeFileSync(
  join(dist, 'robots.txt'),
  [
    '# Every crawler, search engines and AI assistants alike, is welcome on the public pages.',
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /account',
    'Disallow: /friends',
    'Disallow: /design',
    'Disallow: /offline/',
    '',
    `Sitemap: ${app.SITE_URL}/sitemap.xml`,
    '',
  ].join('\n'),
);

// llms.txt (https://llmstxt.org): a short, link-rich summary for AI assistants. The full rules go in llms-full.txt.
const en = (path: string) => app.pageUrl(path, 'en');
const englishNames = new Intl.DisplayNames(['en'], { type: 'language' });
const inWords = (items: readonly string[]) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);
writeFileSync(
  join(dist, 'llms.txt'),
  `# ligungi

> ligungi is a free, open source website to play Gungi online with the official 2022 rules. Gungi (軍儀) is the two-player strategy board game from the HUNTER×HUNTER manga, released as a physical game in 2022. It is similar to shogi, but pieces stack into towers of up to three and a taller tower extends the reach of the piece on top. ligungi is a fan project by Beater Studios, not affiliated with the rights holders.

The site works like lichess: rated and casual games with Glicko-2 ratings, live or by correspondence (days per move), games against the computer, a free analysis board, studies, puzzles, interactive lessons, live games, leaderboards and a rules page with diagrams and an interactive piece trainer. It is available in ${inWords(app.LANGS.map((lang) => englishNames.of(lang) ?? lang))}; add ${new Intl.ListFormat('en', { type: 'disjunction' }).format(app.LANGS.map((lang) => `\`?lang=${lang}\``))} to any page. The site can be used with a screen reader: a screen reader mode (Settings, or the top of the sign in page) announces every move in words, takes typed moves and questions about the position and offers a board moved through with the arrow keys, on every screen with a board. Source priority for the rules: the official 2022 rulebook, then the official Universal Music FAQ.

## Play and learn

- [Home](${en('/')}): quick pairing, open games and live counters
- [How to play](${en('/learn')}): pieces, movement, towers, the draft and checkmate, with an interactive piece trainer
- [Lessons](${en('/lessons')}): interactive lessons, from moving a piece to checkmate
- [Puzzles](${en('/puzzles')}): mates and material wins, with a puzzle rating and a daily puzzle
- [Puzzle Streak](${en('/streak')}) and [Puzzle Storm](${en('/storm')}): puzzles until the first mistake, and as many as possible in 3 minutes
- [Practice](${en('/practice')}): endgame and defense positions against the computer
- [Coordinate trainer](${en('/coordinates')}): learn the names of the squares
- [Play the computer](${en('/computer')}): five levels, no account needed, also from any position
- [Analysis board](${en('/analysis')}): try moves and study positions
- [Board editor](${en('/editor')}): set up any position and check that it follows the rules
- [Draft explorer](${en('/explorer')}): what players place in the draft and how those games end
- [Game search](${en('/games')}): every finished game, filtered by player, mode, rating, result, date and length
- [Studies](${en('/study')}): chapters of moves with variations, comments and drawings, shared by players
- [Players](${en('/players')}): who is online, site counts, the best of each mode and the rating distribution
- [Leaderboard](${en('/ranking')}): best players of each mode
- [Gungi TV](${en('/tv')}): games being played now

## About

- [About](${en('/about')}): the project and the rule sources
- [FAQ](${en('/faq')}): common questions about the rules and the site
- [Contact](${en('/contact')})
- [Friendly sites](${en('/sites')}): other free board game sites built on lila (lichess, lishogi, lidraughts, PlayStrategy) and libaduk for go
- [Terms of service](${en('/terms')})
- [Privacy policy](${en('/privacy')})

## Community

- [Discord server](${app.SITE_URL}/discord): players and the team, with channels in English, Portuguese and Spanish, help with the rules and feedback about the site
- [Source code](${app.SOURCE_URL}): the whole site, AGPL-3.0-or-later, open to contributions and translations
- [Changelog](${app.SOURCE_URL}/blob/main/CHANGELOG.md): what changed in each version

## Optional

- [Full rules specification](${app.SITE_URL}/llms-full.txt): every rule with its source and the interpretations of ambiguous points
`,
);

const rules = resolve(root, '../../docs/rules.md');
if (existsSync(rules)) {
  writeFileSync(
    join(dist, 'llms-full.txt'),
    `# ligungi: Gungi rules specification\n\n> The rules ligungi implements, with sources (official 2022 rulebook first, then the official Universal Music FAQ) and the interpretations of ambiguous points. Play at ${app.SITE_URL}/\n\n${readFileSync(rules, 'utf8')}`,
  );
} else {
  console.warn('docs/rules.md not found: llms-full.txt was not written');
}

console.log(`prerendered ${app.PAGES.length} pages in ${app.LANGS.length} languages, sitemap with ${urls.length} URLs`);
