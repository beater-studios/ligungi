import type { Move, Position } from '@ligungi/engine';
import { spokenMoveText, type Speaker } from './blind.ts';
import { getT } from './i18n/index.ts';
import { prefs, resolveLang, type SpeechPlace } from './prefs.ts';
import { playSound, speak } from './sound.ts';

/** Who made the move, from the viewer's side: their own, their opponent's, or a game they only watch or review. */
export type Mover = 'self' | 'opponent' | 'other';

const speaker = (): Speaker => {
  const { pieceNames, lang } = prefs.get();
  return { t: getT(), names: pieceNames === 'ja' ? 'ja' : resolveLang(lang) };
};

/**
 * Says the move when the player asked for spoken moves at this place and from this side. Quiet with the screen reader
 * mode on, whose own announcements would talk over it. Returns whether it spoke.
 */
export const sayMove = (place: SpeechPlace, before: Position, move: Move, mover: Mover): boolean => {
  const { spokenMoves, spokenPlaces, spokenStyle, screenReader, sound } = prefs.get();
  if (spokenMoves === 'off' || !sound || screenReader || !spokenPlaces.includes(place)) return false;
  if (spokenMoves === 'opponent' && mover === 'self') return false;
  const s = speaker();
  speak(spokenMoveText(s, before, move, spokenStyle), s.t.locale);
  return true;
};

/** The voice when the move is said, else the move or capture sound: where a page used to play only the sound. */
export const moveSound = (place: SpeechPlace, before: Position, move: Move, mover: Mover): void => {
  if (!sayMove(place, before, move, mover)) playSound(move.kind === 'move' && move.action === 'capture' ? 'capture' : 'move');
};

/** A sample for the settings page, in the chosen form, wherever spoken moves are set to go. */
export const speakSample = (before: Position, move: Move): void => {
  const s = speaker();
  speak(spokenMoveText(s, before, move, prefs.get().spokenStyle), s.t.locale);
};
