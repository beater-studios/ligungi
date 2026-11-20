import { useEffect } from 'preact/hooks';
import { prefs, resolveLang } from '../../prefs.ts';
import { useStore } from '../../store.ts';
import { loads, loadPages, pageSource, type LongPage } from './pages.ts';

export { LEGAL_UPDATED, LONG_PAGES, loadAllPages, loadPages, pageSource, type LongPage } from './pages.ts';

export const usePage = (page: LongPage): string | null => {
  const lang = resolveLang(useStore(prefs).lang);
  useStore(loads);
  useEffect(() => void loadPages(lang), [lang]);
  return pageSource(lang, page);
};
