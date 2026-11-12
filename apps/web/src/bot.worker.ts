import { chooseMove, type BotLevel } from '@ligungi/bot';
import { moveToString, parseFen } from '@ligungi/engine';

interface Request {
  readonly id: number;
  readonly fen: string;
  readonly level: BotLevel;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, fen, level } = event.data;
  const move = chooseMove(parseFen(fen), level);
  self.postMessage({ id, move: moveToString(move) });
};
