import { prefs, resolveLang, type Lang } from '../../prefs.ts';
import { useStore } from '../../store.ts';
import { en } from './en.tsx';
import { es } from './es.tsx';
import { pt } from './pt.tsx';
import type { Content } from './shared.tsx';

const CONTENT: Readonly<Record<string, Content>> = { pt, en, es };

/** The long pages in a language; in English until they are translated (they are not on the translation platform yet). */
export const contentFor = (lang: Lang): Content => CONTENT[lang] ?? en;

export const useContent = (): Content => contentFor(resolveLang(useStore(prefs).lang));
