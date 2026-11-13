import type { Messages } from './i18n/index.ts';
import { LINKS, STUDIO } from './i18n/content/shared.tsx';
import { LANGS, type Lang } from './prefs.ts';
import { SITE_URL, SOURCE_URL } from './source.ts';

export type PageKey = Exclude<keyof Messages['seo']['pages'], 'default'>;

export interface Page {
  readonly path: string;
  readonly key: PageKey;
  /** File name of the prerendered HTML (the server maps the path back to it). */
  readonly slug: string;
}

/** Public pages: prerendered at build in every language and listed in the sitemap. */
export const PAGES: readonly Page[] = (
  [
    ['/', 'home'],
    ['/learn', 'learn'],
    ['/computer', 'computer'],
    ['/analysis', 'analysis'],
    ['/tv', 'tv'],
    ['/players', 'players'],
    ['/ranking', 'ranking'],
    ['/about', 'about'],
    ['/faq', 'faq'],
    ['/contact', 'contact'],
    ['/terms', 'terms'],
    ['/privacy', 'privacy'],
  ] as const
).map(([path, key]) => ({ path, key, slug: path === '/' ? 'home' : path.slice(1) }));

/** Pages that are personal or empty without an account: kept out of search results. */
const PRIVATE = /^\/(account|friends|settings|design|login|signup)$/;

export const OG_LOCALES: Readonly<Record<Lang, string>> = { pt: 'pt_BR', en: 'en_US', es: 'es_ES' };
export const HTML_LANGS: Readonly<Record<Lang, string>> = { pt: 'pt-BR', en: 'en', es: 'es' };

export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630 } as const;

/** Address of a page. With a language it is the version fixed to that language (`?lang=`), declared by hreflang. */
export const pageUrl = (path: string, lang?: Lang): string => `${SITE_URL}${path}${lang ? `?lang=${lang}` : ''}`;

export const pageFor = (path: string): Page | undefined => PAGES.find((page) => page.path === path);

export interface HeadInfo {
  readonly title: string;
  readonly description: string;
  readonly noindex: boolean;
}

/** Title and description of any route; routes without their own text get the site defaults. */
export const headInfo = (t: Messages, path: string, found: boolean): HeadInfo => {
  const page = pageFor(path);
  const text = t.seo.pages[page?.key ?? 'default'];
  return { ...text, noindex: !found || PRIVATE.test(path) };
};

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON inside <script>: `<` is escaped so the text can never close the element. */
const jsonLd = (data: object): string =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const organization = { '@type': 'Organization', name: 'Beater Studios', url: STUDIO };

/** Structured data of the home page: the site, the game it offers and who publishes it. */
const homeData = (t: Messages, lang: Lang): object => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'ligungi',
      url: `${SITE_URL}/`,
      inLanguage: LANGS.map((code) => HTML_LANGS[code]),
      description: t.seo.pages.default.description,
      publisher: organization,
    },
    {
      '@type': 'WebApplication',
      name: 'ligungi',
      url: `${SITE_URL}/`,
      description: t.seo.pages.home.description,
      applicationCategory: 'GameApplication',
      genre: 'Board game',
      operatingSystem: 'Any (web browser)',
      inLanguage: HTML_LANGS[lang],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      license: LINKS.agpl,
      codeRepository: SOURCE_URL,
      publisher: organization,
    },
  ],
});

const faqData = (entries: ReadonlyArray<{ q: string; a: string }>): object => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: entries.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

export interface HeadOptions {
  readonly t: Messages;
  readonly lang: Lang;
  readonly page: Page | null;
  /** True for the `?lang=` version of a page, false for the version chosen from the browser language. */
  readonly fixedLang: boolean;
  /** Plain-text questions and answers of the FAQ page. */
  readonly faq?: ReadonlyArray<{ q: string; a: string }>;
}

/** The <head> tags a crawler needs: title, description, canonical, hreflang, Open Graph, Twitter and JSON-LD. */
export const headHtml = ({ t, lang, page, fixedLang, faq }: HeadOptions): string => {
  const { title, description } = t.seo.pages[page?.key ?? 'default'];
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:site_name" content="ligungi" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:image" content="${SITE_URL}${OG_IMAGE.path}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escape(t.seo.imageAlt)}" />`,
    `<meta property="og:locale" content="${OG_LOCALES[lang]}" />`,
    ...LANGS.filter((code) => code !== lang).map((code) => `<meta property="og:locale:alternate" content="${OG_LOCALES[code]}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  if (page) {
    const canonical = pageUrl(page.path, fixedLang ? lang : undefined);
    tags.push(
      `<link rel="canonical" href="${canonical}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      ...LANGS.map((code) => `<link rel="alternate" hreflang="${HTML_LANGS[code]}" href="${pageUrl(page.path, code)}" />`),
      `<link rel="alternate" hreflang="x-default" href="${pageUrl(page.path)}" />`,
    );
    if (page.key === 'home') tags.push(jsonLd(homeData(t, lang)));
    if (page.key === 'faq' && faq?.length) tags.push(jsonLd(faqData(faq)));
  }
  return tags.join('\n    ');
};

/** Keeps the document head in step with client-side navigation (title, description, robots and canonical). */
export const applyHead = (t: Messages, path: string, found: boolean): void => {
  const { title, description, noindex } = headInfo(t, path, found);
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', noindex ? 'noindex' : null);
  const page = pageFor(path);
  const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (page) {
    const params = new URLSearchParams(window.location.search);
    const fixed = params.get('lang');
    const canonical = pageUrl(page.path, LANGS.find((code) => code === fixed));
    if (link) link.href = canonical;
    else document.head.append(Object.assign(document.createElement('link'), { rel: 'canonical', href: canonical }));
  } else link?.remove();
};

const setMeta = (attr: 'name' | 'property', key: string, content: string | null): void => {
  let meta = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) return void meta?.remove();
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, key);
    document.head.append(meta);
  }
  meta.content = content;
};
