import type { PieceNames } from '@ligungi/board';
import type { Outcome } from '@ligungi/engine';
import { formatTimeControl, isErrorCode, type GameSettings, type TimeControl } from '@ligungi/protocol';
import type { ColorChoice } from '@ligungi/protocol';
import { prefs, resolveLang, type Lang, type Theme } from '../prefs.ts';
import { useStore } from '../store.ts';
import { en } from './en.tsx';
import { es } from './es.tsx';
import { pt, type Messages } from './pt.tsx';

export type { Messages };

export const MESSAGES: Readonly<Record<Lang, Messages>> = { pt, en, es };

/** Messages for code outside components (API errors, document title). */
export const getT = (): Messages => MESSAGES[resolveLang(prefs.get().lang)];

export const useT = (): Messages => MESSAGES[resolveLang(useStore(prefs).lang)];

export const usePieceNames = (): PieceNames => {
  const { lang, pieceNames } = useStore(prefs);
  return pieceNames === 'ja' ? 'ja' : resolveLang(lang);
};

/** Players without an account are stored with a placeholder name; show it in the reader's language. */
export const playerName = (t: Messages, player: { readonly name: string; readonly user: unknown }): string =>
  player.user ? player.name : t.common.anonymous;

export const themeLabel = (t: Messages, theme: Theme): string =>
  ({ auto: t.settings.auto, light: t.settings.light, dark: t.settings.dark })[theme];

export const colorChoiceOptions = (t: Messages): { value: ColorChoice; label: string }[] =>
  (['white', 'random', 'black'] as const).map((value) => ({ value, label: t.colorChoices[value] }));

export const errorText = (t: Messages, code: unknown, fallback?: string): string =>
  isErrorCode(code) ? t.errors[code] : (fallback ?? t.genericError);

export const outcomeText = (t: Messages, outcome: Outcome | null, aborted = false): string => {
  if (aborted) return t.aborted;
  if (!outcome) return t.ongoing;
  const reason = t.reasons[outcome.reason];
  return outcome.winner ? t.win(outcome.winner, reason) : t.draw(reason);
};

export const resultSymbol = (outcome: Outcome | null): string =>
  !outcome ? '*' : outcome.winner === 'white' ? '1-0' : outcome.winner === 'black' ? '0-1' : '½-½';

export const timeControlText = (t: Messages, tc: TimeControl | null): string => (tc ? formatTimeControl(tc) : t.noClock);

export const settingsText = (
  t: Messages,
  settings: Pick<GameSettings, 'mode' | 'rated' | 'timeControl'> & { readonly freeDraft?: boolean },
): string =>
  `${t.modes[settings.mode]}${settings.freeDraft ? ` (${t.freeDraftTag})` : ''} · ${timeControlText(t, settings.timeControl)} · ${settings.rated ? t.rated : t.casual}`;

export const formatClock = (ms: number): string => {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  if (total < 10_000) return `${seconds}.${Math.floor((total % 1000) / 100)}`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const formatDate = (t: Messages, ms: number): string =>
  new Date(ms).toLocaleDateString(t.locale, { day: '2-digit', month: 'short', year: 'numeric' });
