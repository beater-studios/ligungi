import { prefs, resolveLang, type Lang } from '../../prefs.ts';
import { useStore } from '../../store.ts';
import { en } from './en.tsx';
import { es } from './es.tsx';
import { pt } from './pt.tsx';
import type { Content } from './shared.tsx';

const CONTENT: Readonly<Record<Lang, Content>> = { pt, en, es };

export const useContent = (): Content => CONTENT[resolveLang(useStore(prefs).lang)];
