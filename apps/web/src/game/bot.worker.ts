import { chooseMove, type BotLevel } from '@ligungi/bot';
import { moveToString, parseFen } from '@ligungi/engine';

interface Request {
  readonly id: number;
  readonly fen: string;
  readonly level: BotLevel;
  /** Repetition keys of the earlier positions of the game. */
  readonly history: readonly string[];
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, fen, level, history } = event.data;
  const move = chooseMove(parseFen(fen), level, { history });
  self.postMessage({ id, move: moveToString(move) });
};
