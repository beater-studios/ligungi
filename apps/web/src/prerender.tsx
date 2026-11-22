/**
 * Build-time entry (vite build --ssr), never shipped to browsers: renders the public pages to HTML so crawlers and
 * link previews that do not run JavaScript still see the content. scripts/prerender.ts drives it.
 */
import type { VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { App } from './app.tsx';
import { consent } from './consent.ts';
import { loadAllPages, pageSource } from './i18n/content/index.ts';
import { faqItems, Markdown } from './i18n/content/markdown.tsx';
import { loadAllLanguages, messagesFor } from './i18n/index.ts';
import { localeOf } from './i18n/languages.ts';
import { LANGS, prefs, type Lang } from './prefs.ts';
import { navigate } from './router.ts';
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

/** Head of routes that are not prerendered (profiles, games): the language is right, the body stays empty. */
export const renderShell = (lang: Lang): Rendered => ({
  lang: localeOf(lang),
  head: headHtml({ t: messagesFor(lang), lang, page: null, fixedLang: false }),
  body: '',
});
