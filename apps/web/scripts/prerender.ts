/**
 * Runs after `vite build` and the SSR build of src/prerender.tsx. Writes, inside dist/:
 * - pages/<lang>/<slug>.html: a public page fixed to one language (served for `?lang=`),
 * - pages/<lang>/<slug>.auto.html: the same page for the plain URL, whose language comes from the browser,
 * - pages/<lang>/shell.html: the head for every other route (profiles, games), with an empty body,
 * - sitemap.xml, robots.txt, llms.txt and llms-full.txt.
 * The server picks the file (apps/server/src/http.ts); the app takes over the markup when it starts.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
type Lang = 'pt' | 'en' | 'es';
interface Prerender {
  readonly LANGS: readonly Lang[];
  readonly HTML_LANGS: Readonly<Record<Lang, string>>;
  readonly PAGES: readonly Page[];
  readonly SITE_URL: string;
  readonly pageUrl: (path: string, lang?: Lang) => string;
  readonly renderPage: (page: Page, lang: Lang, fixedLang: boolean) => Rendered;
  readonly renderShell: (lang: Lang) => Rendered;
}

installBrowserShims();
const app = (await import(pathToFileURL(join(root, 'dist-ssr', 'prerender.js')).href)) as Prerender;

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

const alternates = (path: string): string =>
  [
    ...app.LANGS.map((lang) => `<xhtml:link rel="alternate" hreflang="${app.HTML_LANGS[lang]}" href="${app.pageUrl(path, lang)}"/>`),
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
    '',
    `Sitemap: ${app.SITE_URL}/sitemap.xml`,
    '',
  ].join('\n'),
);

// llms.txt (https://llmstxt.org): a short, link-rich summary for AI assistants. The full rules go in llms-full.txt.
const en = (path: string) => app.pageUrl(path, 'en');
writeFileSync(
  join(dist, 'llms.txt'),
  `# ligungi

> ligungi is a free, open source website to play Gungi online with the official 2022 rules. Gungi (軍儀) is the two-player strategy board game from the HUNTER×HUNTER manga, released as a physical game in 2022. It is similar to shogi, but pieces stack into towers of up to three and a taller tower extends the reach of the piece on top. ligungi is a fan project by Beater Studios, not affiliated with the rights holders.

The site works like lichess: rated and casual games with Glicko-2 ratings, games against the computer, a free analysis board, live games, leaderboards and a rules page with diagrams and an interactive piece trainer. It is available in Portuguese, English and Spanish; add \`?lang=pt\`, \`?lang=en\` or \`?lang=es\` to any page. Source priority for the rules: the official 2022 rulebook, then the official Universal Music FAQ.

## Play and learn

- [Home](${en('/')}): quick pairing, open games and live counters
- [How to play](${en('/learn')}): pieces, movement, towers, the draft and checkmate, with an interactive piece trainer
- [Play the computer](${en('/computer')}): five levels, no account needed
- [Analysis board](${en('/analysis')}): try moves and study positions
- [Players](${en('/players')}): who is online, site counts, the best of each mode and the rating distribution
- [Leaderboard](${en('/ranking')}): best players of each mode
- [Gungi TV](${en('/tv')}): games being played now

## About

- [About](${en('/about')}): the project and the rule sources
- [FAQ](${en('/faq')}): common questions about the rules and the site
- [Contact](${en('/contact')})
- [Terms of service](${en('/terms')})
- [Privacy policy](${en('/privacy')})

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
