import type { PieceNames } from '@ligungi/board';
import type { Outcome } from '@ligungi/engine';
import { DAY_MS, formatTimeControl, isErrorCode, type GameSettings, type TimeControl } from '@ligungi/protocol';
import type { ColorChoice } from '@ligungi/protocol';
import { prefs, resolveLang, updatePrefs, type Prefs, type Theme } from '../prefs/prefs.ts';
import { useStore } from '../core/store.ts';
import { ENGLISH, listText, loadAllLanguages, loadLanguage, loads, messagesFor, pieceNamesFor, type Messages } from './messages.ts';

export { ENGLISH, listText, loadAllLanguages, loadLanguage, messagesFor, pieceNamesFor, type Messages };

/** Switches the language once its messages are in, so the page does not show English in between. */
export const setLanguage = async (lang: Prefs['lang']): Promise<void> => {
  await loadLanguage(resolveLang(lang));
  updatePrefs({ lang });
};

// A language chosen another way (another tab, the browser languages) loads too.
prefs.subscribe(() => void loadLanguage(resolveLang(prefs.get().lang)));

/** Messages for code outside components (API errors, document title). */
export const getT = (): Messages => messagesFor(resolveLang(prefs.get().lang));

export const useT = (): Messages => {
  useStore(loads);
  return messagesFor(resolveLang(useStore(prefs).lang));
};

export const usePieceNames = (): PieceNames => pieceNamesFor(useT(), useStore(prefs).pieceNames);

/** The non-zero counts of an activity entry: "2 wins, 1 loss". */
export const activityRecord = (t: Messages, wins: number, draws: number, losses: number): string =>
  [wins && t.activity.wins(wins), draws && t.activity.draws(draws), losses && t.activity.losses(losses)].filter(Boolean).join(', ');

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

export const timeControlText = (t: Messages, tc: TimeControl | null): string => (tc ? formatTimeControl(tc) : t.noClock);

/** The pace of a game: its clock, or the days per move of a correspondence game. */
export const speedText = (t: Messages, game: { readonly timeControl: TimeControl | null; readonly daysPerMove: number | null }): string =>
  game.daysPerMove ? t.daysPerMove(game.daysPerMove) : timeControlText(t, game.timeControl);

export const settingsText = (
  t: Messages,
  settings: Pick<GameSettings, 'mode' | 'rated' | 'timeControl' | 'daysPerMove'> & { readonly freeDraft?: boolean },
): string =>
  `${t.modes[settings.mode]}${settings.freeDraft ? ` (${t.freeDraftTag})` : ''} · ${speedText(t, settings)} · ${settings.rated ? t.rated : t.casual}`;

export const formatClock = (ms: number): string => {
  const total = Math.max(0, ms);
  // Correspondence: days and hours are enough; the minutes only matter on the last day.
  if (total >= DAY_MS) return `${Math.floor(total / DAY_MS)}d ${Math.floor((total % DAY_MS) / 3_600_000)}h`;
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  if (total < 10_000) return `${seconds}.${Math.floor((total % 1000) / 100)}`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/** Free text a person wrote (a moderator's reason), closed with a period when it has no final punctuation. */
export const asSentence = (text: string): string => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

const regionNames = new Map<string, Intl.DisplayNames | null>();

/** A country's name in the page's language, from the browser; the code itself where the browser has no names. */
export const countryName = (t: Messages, code: string): string => {
  let names = regionNames.get(t.locale);
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([t.locale], { type: 'region' });
    } catch {
      names = null;
    }
    regionNames.set(t.locale, names);
  }
  return names?.of(code.toUpperCase()) ?? code.toUpperCase();
};

export const formatDate = (t: Messages, ms: number): string =>
  new Date(ms).toLocaleDateString(t.locale, { day: '2-digit', month: 'short', year: 'numeric' });

/** How long ago `ms` was, in the language's words ("3 min ago", "yesterday"); past a week, the date. */
export const timeAgo = (t: Messages, ms: number, now = Date.now()): string => {
  // A server clock slightly ahead of the browser's must not turn the past into the future ("in 2 min").
  const seconds = Math.min(0, Math.round((ms - now) / 1000));
  const format = new Intl.RelativeTimeFormat(t.locale, { numeric: 'auto', style: 'short' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
  ];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return format.format(value, unit);
    value = Math.round(value / size);
  }
  return formatDate(t, ms);
};
