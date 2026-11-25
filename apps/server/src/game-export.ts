import { Game, initialPosition, moveToRulebook, moveToString, type Color } from '@ligungi/engine';
import { formatTimeControl } from '@ligungi/protocol';
import type { GameRoom } from './room.ts';

const RESULT: Record<string, string> = { white: '1-0', black: '0-1' };

const date = (ms: number) => new Date(ms).toISOString().slice(0, 10).replaceAll('-', '.');

/**
 * Plain-text export in the spirit of PGN: tag pairs, then one move per line with the rulebook
 * notation followed by the machine notation.
 */
export const exportGame = (room: GameRoom, site: string): string => {
  const outcome = room.outcome;
  const result = outcome ? (outcome.winner ? RESULT[outcome.winner]! : '½-½') : room.status === 'aborted' ? '*' : '?';
  const tag = (name: string, value: string) => `[${name} "${value.replaceAll('"', "'")}"]`;
  const seat = (color: Color) => room.seats[color];
  const lines = [
    tag('Site', `${site}/${room.id}`),
    tag('Date', date(room.createdAt)),
    tag('Mode', room.mode),
    tag('White', seat('white').name),
    tag('Black', seat('black').name),
    ...(seat('white').rating ? [tag('WhiteRating', String(seat('white').rating))] : []),
    ...(seat('black').rating ? [tag('BlackRating', String(seat('black').rating))] : []),
    tag('FirstPlayer', room.firstPlayer),
    ...(room.freeDraft ? [tag('Draft', 'free')] : []),
    tag('TimeControl', formatTimeControl(room.timeControl)),
    tag('Rated', room.rated ? 'yes' : 'no'),
    tag('Result', result),
    tag('Termination', outcome?.reason ?? room.status),
    '',
  ];
  const replay = new Game(initialPosition(room.mode, room.firstPlayer, { freeDraft: room.freeDraft }));
  room.game.moves.forEach((move, index) => {
    const notation = moveToRulebook(replay.position, move);
    lines.push(`${index + 1}. ${notation} {${moveToString(move)}}`);
    replay.play(move);
  });
  lines.push('', result, '');
  return lines.join('\n');
};
