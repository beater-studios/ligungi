/**
 * Build-time entry (vite build --ssr), never shipped to browsers: renders the public pages to HTML so crawlers and
 * link previews that do not run JavaScript still see the content. scripts/prerender.ts drives it.
 */
import type { VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { App } from './app.tsx';
import { consent } from './layout/consent.ts';
import { loadAllPages, pageSource } from './i18n/content/index.ts';
import { faqItems, Markdown } from './i18n/content/markdown.tsx';
import { loadAllLanguages, messagesFor } from './i18n/index.ts';
import { localeOf } from './i18n/languages.ts';
import { LANGS, prefs, type Lang } from './prefs/prefs.ts';
import { navigate } from './core/router.ts';
import { PAGES, headHtml, pageUrl, type Page } from './seo.ts';
import { SITE_URL, SOURCE_URL } from './source.ts';

export { LANGS, PAGES, SITE_URL, SOURCE_URL, localeOf, pageUrl };

/** Loads every language's messages; call it before rendering. */
export const ready = (): Promise<unknown> => Promise.all([loadAllLanguages(), loadAllPages()]);

// Crawlers never answer the cookie notice; keep it out of the indexed text.
consent.set('rejected');

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

const plainText = (node: VNode | string): string =>
  (typeof node === 'string' ? node : renderToString(node))
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();

export interface Rendered {
  readonly lang: string;
  readonly head: string;
  readonly body: string;
}

export const renderPage = (page: Page, lang: Lang, fixedLang: boolean): Rendered => {
  prefs.set({ ...prefs.get(), lang });
  navigate(page.path, false, false);
  const t = messagesFor(lang);
  const faq = page.key === 'faq' ? faqItems(pageSource(lang, 'faq') ?? '').map(({ q, a }) => ({ q, a: plainText(<Markdown source={a} />) })) : undefined;
  return {
    lang: localeOf(lang),
    head: headHtml({ t, lang, page, fixedLang, ...(faq ? { faq } : {}) }),
    body: renderToString(<App />),
  };
};

/** Pages that need no server, kept by the service worker in the installed app so they open without a connection. */
export const OFFLINE_PAGES = ['computer', 'lessons', 'analysis', 'learn'] as const;

/** The texts of the "no connection" page that the service worker shows when a page cannot load. */
export const offlineTexts = (lang: Lang): OfflineTexts => {
  const t = messagesFor(lang);
  return {
    lang: localeOf(lang),
    pageTitle: t.connection.pageTitle,
    pageText: t.connection.pageText,
    retry: t.connection.retry,
    offlineWorks: t.connection.offlineWorks,
    links: [
      { href: '/computer', label: t.nav.playComputer },
      { href: '/lessons', label: t.nav.lessons },
      { href: '/analysis', label: t.nav.analysis },
      { href: '/learn', label: t.nav.rules },
    ],
  };
};

export interface OfflineTexts {
  readonly lang: string;
  readonly pageTitle: string;
  readonly pageText: string;
  readonly retry: string;
  readonly offlineWorks: string;
  readonly links: ReadonlyArray<{ readonly href: string; readonly label: string }>;
}

/** Head of routes that are not prerendered (profiles, games): the language is right, the body stays empty. */
export const renderShell = (lang: Lang): Rendered => ({
  lang: localeOf(lang),
  head: headHtml({ t: messagesFor(lang), lang, page: null, fixedLang: false }),
  body: '',
});
