import { createStore } from '../../core/store.ts';
import { LANGS, type Lang } from '../languages.ts';
import { markdownProblems, placeholdersOf } from './markdown.tsx';

/** The long pages, one Markdown file per language in `content/<lang>/<page>.md`. */
export const LONG_PAGES = ['about', 'faq', 'contact', 'sites', 'terms', 'privacy', 'sources'] as const;
export type LongPage = (typeof LONG_PAGES)[number];

/** Date of the terms and privacy policy in force, shown at their top. */
export const LEGAL_UPDATED = '2026-11-27';

const ENGLISH = import.meta.glob<string>('./en/*.md', { query: '?raw', import: 'default', eager: true });
const FILES = import.meta.glob<string>(['./*/*.md', '!./en/*.md'], { query: '?raw', import: 'default' });

const english = (page: LongPage): string => ENGLISH[`./en/${page}.md`] ?? '';

/** A translation is used when its links and placeholders are the site's and it keeps the English placeholders. */
export const usablePage = (page: LongPage, source: string): boolean =>
  source.trim() !== '' && markdownProblems(source).length === 0 && placeholdersOf(source).join() === placeholdersOf(english(page)).join();

const loaded = new Map<string, string>();
const loading = new Map<string, Promise<void>>();
export const loads = createStore(0);

/** Fetches a language's long pages once; a page missing or unusable in that language stays in English. */
export const loadPages = (lang: Lang): Promise<void> => {
  if (lang === 'en') return Promise.resolve();
  let promise = loading.get(lang);
  if (!promise) {
    promise = Promise.all(
      LONG_PAGES.map(async (page) => {
        const file = FILES[`./${lang}/${page}.md`];
        const source = file ? await file().catch(() => '') : '';
        loaded.set(`${lang}/${page}`, usablePage(page, source) ? source : english(page));
      }),
    ).then(() => loads.set((n) => n + 1));
    loading.set(lang, promise);
  }
  return promise;
};

/** For the prerender, which renders every language. */
export const loadAllPages = (): Promise<unknown> => Promise.all(LANGS.map(loadPages));

/** A page's Markdown in a language; `null` while that language's pages are still loading. */
export const pageSource = (lang: Lang, page: LongPage): string | null => (lang === 'en' ? english(page) : (loaded.get(`${lang}/${page}`) ?? null));
